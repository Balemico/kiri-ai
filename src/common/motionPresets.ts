/**
 * Shared Motion presets. RULE: any element whose position can change because the layout around
 * it changes (a column re-centring, a sibling appearing/leaving) gets `layout="position"` with
 * `LAYOUT_TRANSITION`, inside a `LayoutGroup` spanning the region — it glides, never jumps.
 */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export const LAYOUT_TRANSITION = { duration: 0.55, ease: EASE_OUT };
