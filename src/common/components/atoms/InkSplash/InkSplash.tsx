import { useId, useMemo, type CSSProperties } from "react";
import { rng } from "../../../ink/inkMath";

export interface InkSplashProps {
	color: string;
	/** Deterministic shape: the same seed always draws the same splash. */
	seed?: number;
	/** Rendered edge in px (the splash is square). */
	size: number;
	/** Fling the ink along this line (radians, screen, counter-clockwise) instead of all round: no
	 *  pooled core — just droplets and streaks thrown off both ways, as off a sword cut. */
	direction?: number;
	style?: CSSProperties;
}

/** Closed blob through `n` points of noisy radius, smoothed with quadratic midpoints. */
const blobPath = (rand: () => number, cx: number, cy: number, r: number, n: number, jitter: number): string => {
	const pts = Array.from({ length: n }, (_, i) => {
		const a = (i / n) * Math.PI * 2;
		const rr = r * (1 - jitter / 2 + rand() * jitter);
		return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
	});
	const mid = (p: number[], q: number[]) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
	const start = mid(pts[n - 1], pts[0]);
	let d = `M${start[0].toFixed(1)} ${start[1].toFixed(1)}`;
	pts.forEach((p, i) => {
		const m = mid(p, pts[(i + 1) % n]);
		d += ` Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`;
	});
	return `${d}Z`;
};

interface Shape {
	core: string | null;
	drops: { x: number; y: number; r: number }[];
	streaks: { d: string; w: number }[];
}

/**
 * One splash in a 200×200 box: a ragged core, flung droplets and a few thrown streaks — or, given a
 * `direction`, a spray thrown off both ways along that line (fanned by a narrow cone), no core.
 */
const buildSplash = (seed: number, direction?: number): Shape => {
	const rand = rng(seed);
	const directed = direction !== undefined;
	// SVG y points down, so a counter-clockwise screen angle is negated here.
	const angle = () => (directed ? -direction + (rand() - 0.5) * 0.7 + (rand() < 0.5 ? 0 : Math.PI) : rand() * Math.PI * 2);
	const core = directed ? null : blobPath(rand, 100, 100, 38, 22, 0.55);
	const drops = Array.from({ length: directed ? 26 : 16 }, () => {
		const a = angle();
		const dist = directed ? 18 + rand() * 82 : 46 + rand() * 50;
		return { x: 100 + Math.cos(a) * dist, y: 100 + Math.sin(a) * dist, r: 1.2 + rand() * (dist < 70 ? 6 : 3.5) };
	});
	const streaks = Array.from({ length: directed ? 7 : 5 }, () => {
		const a = angle();
		const r0 = directed ? 12 + rand() * 20 : 30 + rand() * 10;
		const r1 = 62 + rand() * 30;
		const bend = (rand() - 0.5) * 0.3;
		const p = (r: number, da = 0) => `${(100 + Math.cos(a + da) * r).toFixed(1)} ${(100 + Math.sin(a + da) * r).toFixed(1)}`;
		return { d: `M${p(r0)} Q${p((r0 + r1) / 2, bend)} ${p(r1)}`, w: 3 + rand() * 5 };
	});
	return { core, drops, streaks };
};

/**
 * A procedural sumi splash (no asset): seeded geometry roughened by an SVG turbulence displacement,
 * so the edges bleed like ink on washi rather than reading as vector circles.
 */
export const InkSplash = ({ color, seed = 1, size, direction, style }: InkSplashProps) => {
	const filterId = useId().replace(/:/g, "");
	const shape = useMemo(() => buildSplash(seed, direction), [seed, direction]);
	return (
		<svg viewBox="0 0 200 200" width={size} height={size} style={{ overflow: "visible", ...style }} aria-hidden>
			<defs>
				<filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
					<feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="3" seed={seed % 97} />
					<feDisplacementMap in="SourceGraphic" scale="9" />
				</filter>
			</defs>
			<g filter={`url(#${filterId})`} fill={color}>
				{shape.core && <path d={shape.core} />}
				{shape.drops.map((d, i) => (
					<circle key={i} cx={d.x} cy={d.y} r={d.r} />
				))}
				{shape.streaks.map((s, i) => (
					<path key={i} d={s.d} stroke={color} strokeWidth={s.w} strokeLinecap="round" fill="none" />
				))}
			</g>
		</svg>
	);
};
