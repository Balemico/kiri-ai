import { useEffect } from "react";
import { useControls } from "leva";
import { MUSIC } from "../layout";
import { setMusicFades, setMusicMuted, setMusicVolume } from "../music";

export interface MusicControls {
	muted: boolean;
	volume: number;
	fadeIn: number;
	fadeOut: number;
	crossfade: number;
}

/** Live-tunable background-music settings in their own (collapsed) Leva folder; pushes them into music.ts. */
export const useMusicControls = (): MusicControls => {
	const controls = useControls(
		"Music",
		{
			muted: { value: MUSIC.muted, label: "muted" },
			volume: { value: MUSIC.volume, min: 0, max: 1, step: 0.05 },
			fadeIn: { value: MUSIC.fadeIn, min: 0, max: 10, step: 0.25 },
			fadeOut: { value: MUSIC.fadeOut, min: 0, max: 10, step: 0.25 },
			crossfade: { value: MUSIC.crossfade, min: 0, max: 10, step: 0.25 },
		},
		{ collapsed: true },
	) as MusicControls;

	const { muted, volume, fadeIn, fadeOut, crossfade } = controls;
	useEffect(() => setMusicMuted(muted), [muted]);
	useEffect(() => setMusicVolume(volume), [volume]);
	useEffect(() => setMusicFades({ fadeIn, fadeOut, crossfade }), [fadeIn, fadeOut, crossfade]);

	return controls;
};
