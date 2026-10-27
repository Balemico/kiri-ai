import { Color, Vector2 } from "three";
import { MeshBasicNodeMaterial, type Node } from "three/webgpu";
import {
	PI,
	abs,
	clamp,
	cos,
	dot,
	float,
	floor,
	fract,
	length,
	max,
	mix,
	mx_cell_noise_float,
	mx_fractal_noise_float,
	mx_noise_float,
	pow,
	sin,
	smoothstep,
	step,
	time,
	uniform,
	uv,
	vec2,
	vec3,
	type ShaderNodeObject,
} from "three/tsl";
import { INK } from "../layout";
import type { VeilStroke } from "./inkMath";

/**
 * Action sumi-e in TSL (WebGPU, or WebGL2 through WebGPURenderer's fallback) — the haboku /
 * hatsuboku look of a fast dry brush: solid black where the brush is loaded, splitting into
 * parallel bristle streaks (kasure, "flying white") as it runs dry along the stroke and at its
 * flanks, droplets flung off in the direction of travel, and a pale diluted wash bleeding beside
 * the black. Everything is procedural — no textures.
 *
 * The unit is ONE BRUSH STROKE in its own frame: `s` runs along the gesture (0 head → 1 tip),
 * `n` across it (−1..1 between the flanks). Bristles are noise in `n` stretched along `s`, so
 * the streaks follow the gesture; the ink load drops along `s` and toward |n| = 1; the paper's
 * tooth breaks the dry parts. Only the wash edge evolves with `time` — the wet bleed keeps
 * creeping and breathing — while the dry-brush marks stay put, as they would on paper.
 */

type N = ShaderNodeObject<Node>;

/** A float uniform widened to `number` (not the literal type of its default). */
const num = (v: number) => uniform(v);

/** Live look parameters shared by every ink material (driven by the "Ink" Leva folder). */
export const INK_LOOK = {
	bristles: num(INK.bristles),
	tailDry: num(INK.tailDry),
	edgeDry: num(INK.edgeDry),
	tooth: num(INK.tooth),
	wash: num(INK.wash),
	splatter: num(INK.splatter),
	drift: num(INK.drift),
	strokeHeight: num(INK.strokeHeight),
	inkColor: uniform(new Color(INK.inkColor)),
};

interface BrushSpec {
	/** Fragment position, px. */
	P: N;
	/** Stroke centre, px. */
	centre: N;
	/** Unit travel direction of the brush. */
	dir: N;
	/** Stroke length and full width, px. */
	length: N;
	width: N;
	/** Bow of the centre line, px (signed). */
	bend: N;
	seed: N;
	/** How far the brush has travelled, in `s` (≥ 1.2 = done, splatter included). */
	front: N;
	/** Extra dryness 0..1 — the veil's drying-out (1 = nothing left). */
	dry: N;
	/** Multiplier on bristle count across the stroke (giant veil strokes carry more bristles). */
	bristleScale: number;
	/** Multiplier on splatter droplet sizes / spacing (px). */
	dropScale: N;
	/** Droplet density along the tip / the flanks (0..1). */
	tipDrops: number;
	flankDrops: number;
	/** Multiplier on the pale wash (giant overlapping slashes need less, or they fog together). */
	washScale: number;
	/** Straight stroke (menu, like the kanji 一): constant width with parallel flanks, BOTH ends
	 *  splitting into bristles of uneven length, alike — versus the tapering slash (veil):
	 *  pressed head, long dry taper. */
	straight: boolean;
	/** Bow/tremor/swell amplitude multiplier (lower = a more controlled, refined hand). */
	wildness: number;
}

/** Flung droplets on an anisotropic cell grid in stroke space (cells stretched along the gesture). */
const droplets = (x: N, y: N, s: N, zs: N, n: N, b: BrushSpec, cellAlong: number, cellAcross: number, rMin: number, rMax: number, density: number, z: number): N => {
	const cl = b.dropScale.mul(cellAlong);
	const cw = b.dropScale.mul(cellAcross);
	const g = vec2(x.div(cl), y.div(cw));
	const cell = floor(g);
	const f = fract(g);
	const r0 = mx_cell_noise_float(vec3(cell, b.seed.add(z)));
	const r1 = mx_cell_noise_float(vec3(cell, b.seed.add(z + 1.37)));
	const r2 = mx_cell_noise_float(vec3(cell, b.seed.add(z + 2.71)));
	const r3 = mx_cell_noise_float(vec3(cell, b.seed.add(z + 4.13)));
	// Where drops fly: thrown past the slowing tip, and flicked off the flanks along the body.
	// `zs` = position along the stroke for the zones (a straight stroke folds both ends onto 1).
	const tipZone = smoothstep(0.45, 0.85, zs).mul(smoothstep(1.55, 1.0, zs)).mul(smoothstep(3.0, 0.9, abs(n)));
	const flankZone = smoothstep(0.08, 0.3, zs).mul(smoothstep(1.1, 0.7, zs)).mul(smoothstep(0.9, 0, abs(abs(n).sub(1.6))));
	const zone = tipZone.mul(b.tipDrops).add(flankZone.mul(b.flankDrops)).mul(INK_LOOK.splatter).mul(density);
	const exists = step(float(1).sub(zone), r0);
	const centre = vec2(r1, r2).mul(0.56).add(0.22);
	// Mostly fine spray, a few fat drops; stretched along the travel by their speed.
	const radius = mix(float(rMin), float(rMax), pow(r3, 3)).mul(b.dropScale);
	const elong = mix(float(1.2), float(2.6), r1);
	const dd = length(f.sub(centre).mul(vec2(cl, cw)).div(vec2(elong, 1)));
	const drop = smoothstep(radius, radius.mul(0.55), dd).mul(exists);
	// A drop exists only once the brush has passed and flung it.
	// Straight strokes open from the middle, so a drop appears when its END reaches it.
	const along = b.straight ? zs.sub(0.5).mul(2) : s;
	return drop.mul(step(along, b.front.sub(0.08)));
};

/** One brush stroke → { ink, wash, drops } coverages (0..1). */
const brush = (b: BrushSpec) => {
	const L = INK_LOOK;
	const d = b.P.sub(b.centre);
	const x = dot(d, b.dir);
	const y = dot(d, vec2(b.dir.y.negate(), b.dir.x));
	const s = x.div(b.length).add(0.5);
	const sc = clamp(s, 0, 1);
	// Centre line: a bow plus the hand's tremor.
	const wobble = mx_noise_float(vec3(s.mul(3.1), b.seed, 0.5)).mul(b.width.mul(0.05 * b.wildness));
	const yc = sin(sc.mul(PI)).mul(b.bend).add(wobble);
	// Pressure. Slash: a rounded attack (brush pressed down — quarter-circle profile), a swell,
	// a long taper to the tip. Straight: constant width — its ends are cut below, in px.
	const a = smoothstep(-0.015, 0.09, s);
	const cap = b.straight ? float(1) : a.mul(float(2).sub(a)).sqrt();
	const taper = b.straight ? float(1) : mix(float(1), float(0.3), smoothstep(0.5, 1.0, s));
	const swell = mx_noise_float(vec3(s.mul(4.3), b.seed.add(3.3), 0)).mul(0.1 * b.wildness).add(1);
	const ends = b.straight ? float(1) : smoothstep(1.04, 0.97, s);
	const half = max(b.width.mul(0.5).mul(cap).mul(taper).mul(swell).mul(ends), 0.001);
	const n = y.sub(yc).div(half);
	const an = abs(n);

	// Bristles: clumps across, long streaks along (static — dry-brush marks don't move).
	const bristleN = L.bristles.mul(b.bristleScale);
	const bA = mx_noise_float(vec3(n.mul(bristleN), s.mul(1.4), b.seed.add(7.1)));
	const bB = mx_noise_float(vec3(n.mul(bristleN.mul(3.7)), s.mul(3.6), b.seed.add(13.7)));
	const bristle = bA.mul(0.62).add(bB.mul(0.38)).mul(0.5).add(0.5);
	// Paper tooth (screen space) — the dry brush skips over the grain.
	const tooth = mx_noise_float(vec3(b.P.mul(0.42), b.seed.add(2.9))).mul(0.5).add(0.5);
	const tex = mix(bristle, tooth, L.tooth);
	// Ink load: full at the head, running dry toward the tip and at the splayed flanks.
	// A straight stroke stays loaded through the body and runs dry at both ends alike.
	const ends01 = abs(s.sub(0.5)).mul(2); // 0 middle → 1 at either end
	const runDry = b.straight ? smoothstep(0.6, 1.04, ends01).mul(L.tailDry) : smoothstep(0.38, 1.0, s).mul(L.tailDry);
	const load = float(1)
		.sub(runDry)
		.sub(smoothstep(0.45, 1.0, an).mul(L.edgeDry))
		.sub(b.dry.mul(1.25));
	const thr = float(1).sub(load);
	const filled = smoothstep(thr.sub(0.05), thr.add(0.05), tex);
	// Ragged flank: bristle ends stick out unevenly.
	const flank = bristle.sub(0.5).mul(b.straight ? 0.1 : 0.22).add(0.98);
	// Straight ends, in px, mirror images: at each end the bristles reach unevenly (streaks of
	// different length) along a slightly oblique cut. The head uses its own bristle draw so the
	// two ends match in character without being copies.
	const hw = b.width.mul(0.5);
	const bristleHead = mx_noise_float(vec3(n.mul(bristleN), s.mul(1.4), b.seed.add(31.3))).mul(0.62).add(bB.mul(0.38)).mul(0.5).add(0.5);
	const dHead = x.add(b.length.mul(0.5)).sub(n.mul(hw.mul(0.12))).add(bristleHead.sub(0.5).mul(hw.mul(1.8)));
	const dTip = b.length.mul(0.5).sub(x).add(n.mul(hw.mul(0.12))).add(bristle.sub(0.5).mul(hw.mul(1.8)));
	const straightEnds = smoothstep(0, 1.5, dHead).mul(smoothstep(0, 1.5, dTip));
	const body = smoothstep(flank, flank.sub(float(1.6).div(half)), an).mul(b.straight ? straightEnds : step(0, s));
	// The brush front: bristles lead and lag a little, so the frontier itself is streaky.
	// Slash: the brush front travels head → tip, bristles leading and lagging a little.
	// Straight: the stroke OPENS from the middle toward both ends at once, on a soft frontier
	// (a wide feather, streaked by the bristles) — no hard sweep line.
	const lead = b.front.add(bristle.sub(0.5).mul(b.straight ? 0.14 : 0.05));
	const drawn = b.straight ? smoothstep(lead, lead.sub(0.16), ends01) : smoothstep(lead, lead.sub(0.012), s);
	// Loaded bristles deposit slightly unevenly — sumi is never flat black.
	const ink = body.mul(filled).mul(drawn).mul(bristle.mul(0.3).add(0.78));

	// Pale wash (bokashi): diluted ink bleeding past the flanks near the head and body, its edge
	// creeping slowly — the one part that stays alive after the stroke is laid.
	const t = time.mul(L.drift);
	const washEdge = mx_fractal_noise_float(vec3(x.mul(0.01), y.mul(0.01), t.add(b.seed)), 3, 2.0, 0.5).mul(0.35).add(1.4);
	const washShape = smoothstep(washEdge, washEdge.sub(0.55), an).mul(b.straight ? smoothstep(1.02, 0.7, ends01) : smoothstep(-0.02, 0.08, s).mul(smoothstep(0.95, 0.45, s)));
	const washDrawn = b.straight ? smoothstep(b.front, b.front.sub(0.35), ends01) : smoothstep(b.front, b.front.sub(0.15), s);
	const washBody = mx_noise_float(vec3(b.P.mul(0.012), t.mul(0.6).add(b.seed.add(5.5)))).mul(0.35).add(0.65);
	const wash = washShape.mul(washDrawn).mul(washBody).mul(L.wash).mul(b.washScale).mul(clamp(float(1).sub(b.dry.mul(2)), 0, 1));

	const dropsFade = clamp(float(1).sub(b.dry.mul(2.2)), 0, 1);
	const zs = b.straight ? ends01.mul(0.5).add(0.5) : s;
	const drops = max(
		droplets(x, y, s, zs, n, b, 30, 22, 1.4, 7.5, 0.5, 0),
		droplets(x, y, s, zs, n, b, 11, 8, 0.5, 2.1, 0.45, 20),
	).mul(dropsFade);
	return { ink, wash, drops };
};

/** Union of coverages: 1 − Π(1 − cᵢ). */
const union = (...c: N[]): N => float(1).sub(c.reduce<N>((acc, v) => acc.mul(float(1).sub(clamp(v, 0, 1))), float(1)));

const baseMaterial = (): MeshBasicNodeMaterial => {
	const m = new MeshBasicNodeMaterial();
	m.transparent = true;
	m.depthWrite = false;
	m.depthTest = false;
	m.toneMapped = false;
	return m;
};

/** The uniform handles a material was built with (stashed on `userData.ink`), for frame-loop updates
 *  through a mesh ref — mutating a render-time value from `useFrame` is lint-forbidden. */
export const inkUniforms = <T>(material: unknown): T => (material as MeshBasicNodeMaterial).userData.ink as T;

type U<T> = ShaderNodeObject<Node> & { value: T };

/** Uniform handles of one button stroke. */
export interface StrokeUniforms {
	/** Plane size in px (button box + margin on every side). */
	size: U<Vector2>;
	margin: U<number>;
	/** 0 → 1: the brush slashes left → right (and flings its spray at the end). */
	pour: U<number>;
	hover: U<number>;
	seed: U<number>;
	tint: U<Color>;
	/** Mix from sumi to the tint (0 = black ink, 1 = coloured stroke). */
	tintAmount: U<number>;
	opacity: U<number>;
}

/**
 * One straight brush stroke behind a menu button (like the kanji 一), centred under the label:
 * parallel flanks, both ends splitting alike into bristles of uneven reach, fine bristles and a
 * whisper of spray off either end. A barely-there per-seed tilt and bow keep siblings apart.
 */
export const createStrokeMaterial = (): { material: MeshBasicNodeMaterial; u: StrokeUniforms } => {
	const u = {
		size: uniform(new Vector2(1, 1)),
		margin: num(INK.strokeMargin),
		pour: num(0),
		hover: num(0),
		seed: num(0),
		tint: uniform(new Color(INK.inkColor)),
		tintAmount: num(0),
		opacity: num(1),
	} as unknown as StrokeUniforms;

	const P = uv().mul(u.size);
	const box = u.size.sub(u.margin.mul(2));
	// Centred on the button (the label sits in the middle of the stroke), overhanging both ends
	// equally; a barely-there tilt and bow so siblings still differ.
	const tilt = sin(u.seed.mul(12.9898)).mul(0.008);
	const dir = vec2(cos(tilt), sin(tilt));
	// Hover reaches out: the stroke lengthens equally at both ends (eased in InkLayer).
	const len = box.x.add(u.margin.mul(0.5)).add(u.hover.mul(u.margin.mul(0.6)));
	const centre = u.size.mul(0.5);
	const width = box.y.mul(INK_LOOK.strokeHeight).mul(u.hover.mul(0.07).add(1));
	const bend = box.y.mul(0.03).mul(sin(u.seed.mul(7.31)));
	const { ink, wash, drops } = brush({
		P,
		centre,
		dir,
		length: len,
		width,
		bend,
		seed: u.seed,
		// Opens from the middle to slightly past both ends…
		front: u.pour.mul(1.15),
		// …while the load builds: bristle streaks first, soaking to full black (the wash and the
		// spray bloom in last, since `dry` holds them back too).
		dry: float(1).sub(u.pour).mul(0.55),
		bristleScale: 1.7,
		dropScale: float(0.6),
		tipDrops: 0.3,
		flankDrops: 0.03,
		washScale: 0.55,
		straight: true,
		wildness: 0.35,
	});
	// Hover deepens the wash WHERE IT ALREADY IS (multiply) — adding to it would tint the whole plane.
	// A coloured wash reads as a pastel glow, not diluted ink: tinted strokes keep only a trace.
	const washTone = float(1).sub(u.tintAmount.mul(0.8));
	const alpha = union(ink, wash.mul(u.hover.mul(0.8).add(1)).mul(washTone), drops);
	const material = baseMaterial();
	material.colorNode = mix(INK_LOOK.inkColor, u.tint, u.tintAmount);
	material.opacityNode = alpha.mul(u.opacity);
	material.userData.ink = u;
	return { material, u };
};

/** Uniform handles of the full-screen veil. */
export interface VeilUniforms {
	/** Canvas size in px. */
	resolution: U<Vector2>;
	/** 0 → 1: the slashes land one after another, then the flood seals the gaps. */
	pour: U<number>;
	/** 0 → 1: the cover dries into bristle streaks and lifts away. */
	dry: U<number>;
}

/**
 * The lobby→duel veil: giant alternating slashes cut across the screen in sequence (each with its
 * own bristles, spray and wash), then a flood of ink seals the dry-brush gaps → full cover. On
 * release the flood drains first, then every slash dries from its flanks and tip inward into
 * streaks, which thin out and vanish — the duel shows through the bristle lines.
 * Geometry comes from `veilStrokes` (screen-height units), baked at build time.
 */
export const createVeilMaterial = (strokes: VeilStroke[]): { material: MeshBasicNodeMaterial; u: VeilUniforms } => {
	const u = {
		resolution: uniform(new Vector2(1, 1)),
		pour: num(0),
		dry: num(0),
	} as unknown as VeilUniforms;

	const H = u.resolution.y;
	const P = uv().mul(u.resolution); // px, origin bottom-left
	const half = u.resolution.mul(0.5);
	// Giant strokes: more bristles across, bigger flung drops (scaled to the screen).
	const dropScale = H.div(700);
	const coverages: N[] = [];
	strokes.forEach((st, i) => {
		const grow = clamp(u.pour.sub(st.start).div(st.dur), 0, 1);
		const front = float(1).sub(pow(float(1).sub(grow), 2.2)).mul(1.3);
		const { ink, wash, drops } = brush({
			P,
			centre: half.add(vec2(st.cx, st.cy).mul(H)),
			dir: vec2(Math.cos(st.angle), Math.sin(st.angle)),
			length: H.mul(st.length),
			width: H.mul(st.width),
			bend: H.mul(st.bend),
			seed: float(11 + i * 7.7),
			front,
			// The tips dry first: later strokes (on top) linger a touch longer.
			dry: clamp(u.dry.mul(1.15).sub(i * 0.025), 0, 1),
			bristleScale: 2.4,
			dropScale,
			tipDrops: 0.4,
			flankDrops: 0.15,
			washScale: 0.35,
			straight: false,
			wildness: 1,
		});
		coverages.push(ink, wash, drops);
	});
	// Flood: ink soaks the gaps once every slash has landed; it drains first when drying.
	const flood = smoothstep(0.86, 1, u.pour).mul(smoothstep(0.3, 0, u.dry));
	const alpha = union(...coverages, flood);
	const material = baseMaterial();
	material.colorNode = INK_LOOK.inkColor;
	material.opacityNode = alpha;
	material.userData.ink = u;
	return { material, u };
};
