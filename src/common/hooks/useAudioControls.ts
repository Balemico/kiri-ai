import { useEffect } from "react";
import { useControls } from "leva";
import { AUDIO } from "../layout";
import { setAudioMuted, setAudioVolume } from "../audio";

export interface AudioControls {
	muted: boolean;
	volume: number;
}

/** Live-tunable sound settings in their own (collapsed) Leva folder; pushes them into the audio module. */
export const useAudioControls = (): AudioControls => {
	const controls = useControls(
		"Game Audio",
		{
			muted: { value: AUDIO.muted, label: "muted" },
			volume: { value: AUDIO.volume, min: 0, max: 1, step: 0.05 },
		},
		{ collapsed: true },
	) as AudioControls;

	useEffect(() => setAudioMuted(controls.muted), [controls.muted]);
	useEffect(() => setAudioVolume(controls.volume), [controls.volume]);

	return controls;
};
