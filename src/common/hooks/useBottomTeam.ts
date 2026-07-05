import type { Team } from "../game";
import { useLagged } from "./useLagged";

// Portrait CONFIRM choreography, staged as delays after the viewer's team changes (pass & play, when
// the device is handed over):
//   0ms      the hand drops away
//   COVER    the just-placed cards flip face-down (in place)
//   INVERT   the view inverts (bottomTeam swaps → pawns + card columns change sides)
//   HAND_IN  the next player's hand rises back in
// Online the viewer team is fixed, so none of these ever fire (the lag input never changes).
export const CONFIRM_COVER_MS = 350;
export const CONFIRM_INVERT_MS = 950;
export const CONFIRM_HAND_IN_MS = 1550;

/**
 * Which team sits at the bottom of the portrait view = the viewer's own colour — but its CHANGES are
 * held until the INVERT beat of the CONFIRM choreography, so the cards cover (and the hand drops)
 * before the view inverts. Landscape ignores bottomTeam, so this is a no-op there.
 */
export const useBottomTeam = (viewerTeam: Team): Team => useLagged(viewerTeam, CONFIRM_INVERT_MS);
