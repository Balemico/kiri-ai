import { useControls } from "leva";
import { LANDING_ZONES, type LandingZoneConfig } from "../layout";

export type LandingZoneControls = LandingZoneConfig;

/**
 * Landing-zone placeholders (portrait only), in their own collapsed "Landing Zones" folder. Defaults
 * come from the single LANDING_ZONES object in layout.ts. Portrait-only, so there is no Landscape /
 * Portrait split here.
 */
export const useLandingZoneControls = (): LandingZoneControls =>
	useControls(
		"Landing Zones",
		{
			usedRed: { value: LANDING_ZONES.usedRed, label: "used · red" },
			usedBlue: { value: LANDING_ZONES.usedBlue, label: "used · blue" },
			setAsideRed: { value: LANDING_ZONES.setAsideRed, label: "set-aside · red" },
			setAsideBlue: { value: LANDING_ZONES.setAsideBlue, label: "set-aside · blue" },
			lineWidth: { value: LANDING_ZONES.lineWidth, min: 1, max: 8, step: 0.5 },
			dash: { value: LANDING_ZONES.dash, min: 0.02, max: 0.4, step: 0.01 },
			gap: { value: LANDING_ZONES.gap, min: 0.02, max: 0.4, step: 0.01 },
			cornerRadius: { value: LANDING_ZONES.cornerRadius, min: 0, max: 0.3, step: 0.01 },
			inset: { value: LANDING_ZONES.inset, min: 0, max: 0.2, step: 0.005 },
			outlineOpacity: { value: LANDING_ZONES.outlineOpacity, min: 0, max: 1, step: 0.05 },
			fillOpacity: { value: LANDING_ZONES.fillOpacity, min: 0, max: 0.5, step: 0.01 },
			numberScale: { value: LANDING_ZONES.numberScale, min: 0.2, max: 0.9, step: 0.05 },
			numberOpacity: { value: LANDING_ZONES.numberOpacity, min: 0, max: 1, step: 0.05 },
		},
		{ collapsed: true },
	) as LandingZoneControls;
