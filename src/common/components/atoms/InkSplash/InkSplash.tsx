import { useId, useMemo, type CSSProperties } from "react";

export interface InkSplashProps {
	color: string;
	/** Deterministic shape: the same seed always draws the same splash. */
	seed?: number;
	/** Rendered edge in px (the splash is square). */
	size: number;
	style?: CSSProperties;
}

/** Tiny seeded PRNG (mulberry32) — the splash must not reshuffle on re-render. */
const rng = (seed: number) => {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

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
	core: string;
	drops: { x: number; y: number; r: number }[];
	streaks: { d: string; w: number }[];
}

/** One splash in a 200×200 box: a ragged core, flung droplets and a few thrown streaks. */
const buildSplash = (seed: number): Shape => {
	const rand = rng(seed);
	const core = blobPath(rand, 100, 100, 38, 22, 0.55);
	const drops = Array.from({ length: 16 }, () => {
		const a = rand() * Math.PI * 2;
		const dist = 46 + rand() * 50;
		return { x: 100 + Math.cos(a) * dist, y: 100 + Math.sin(a) * dist, r: 1.5 + rand() * (dist < 70 ? 7 : 4) };
	});
	const streaks = Array.from({ length: 5 }, () => {
		const a = rand() * Math.PI * 2;
		const r0 = 30 + rand() * 10;
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
export const InkSplash = ({ color, seed = 1, size, style }: InkSplashProps) => {
	const filterId = useId().replace(/:/g, "");
	const shape = useMemo(() => buildSplash(seed), [seed]);
	return (
		<svg viewBox="0 0 200 200" width={size} height={size} style={{ overflow: "visible", ...style }} aria-hidden>
			<defs>
				<filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
					<feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="3" seed={seed % 97} />
					<feDisplacementMap in="SourceGraphic" scale="9" />
				</filter>
			</defs>
			<g filter={`url(#${filterId})`} fill={color}>
				<path d={shape.core} />
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
