import { useEffect } from "react";
import { useControls } from "leva";
import { AUDIO } from "../layout";
import { setAudioMuted, setAudioVolume, setSoundGain } from "../audio";

export interface AudioControls {
	muted: boolean;
	volume: number;
	cardDeal: number;
	cardPick: number;
	cardPlace: number;
	veil: number;
	handoff: number;
	rise: number;
	cardCover: number;
}

/** Live-tunable sound settings in their own (collapsed) Leva folder; pushes them into the audio module. */
export const useAudioControls = (): AudioControls => {
	const controls = useControls(
		"Game Audio",
		{
			muted: { value: AUDIO.muted, label: "muted" },
			volume: { value: AUDIO.volume, min: 0, max: 1, step: 0.05 },
			cardDeal: { value: AUDIO.cardDeal, min: 0, max: 1, step: 0.05, label: "card deal" },
			cardPick: { value: AUDIO.cardPick, min: 0, max: 1, step: 0.05, label: "card pick" },
			cardPlace: { value: AUDIO.cardPlace, min: 0, max: 1, step: 0.05, label: "card place" },
			veil: { value: AUDIO.veil, min: 0, max: 1, step: 0.05, label: "ink veil" },
			handoff: { value: AUDIO.handoff, min: 0, max: 1, step: 0.05, label: "hand-over" },
			rise: { value: AUDIO.rise, min: 0, max: 1, step: 0.05, label: "samurai rise" },
			cardCover: { value: AUDIO.cardCover, min: 0, max: 1, step: 0.05, label: "card cover" },
		},
		{ collapsed: true },
	) as AudioControls;

	useEffect(() => setAudioMuted(controls.muted), [controls.muted]);
	useEffect(() => setAudioVolume(controls.volume), [controls.volume]);
	useEffect(() => setSoundGain("cardDeal", controls.cardDeal), [controls.cardDeal]);
	useEffect(() => setSoundGain("cardPick", controls.cardPick), [controls.cardPick]);
	useEffect(() => setSoundGain("cardPlace", controls.cardPlace), [controls.cardPlace]);
	useEffect(() => setSoundGain("veil", controls.veil), [controls.veil]);
	useEffect(() => setSoundGain("handoff", controls.handoff), [controls.handoff]);
	useEffect(() => setSoundGain("rise", controls.rise), [controls.rise]);
	useEffect(() => setSoundGain("cardCover", controls.cardCover), [controls.cardCover]);

	return controls;
};
