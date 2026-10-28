import { motion } from "motion/react";
import type { Stance } from "../../../game";
import { STANCE_LABEL } from "../../../hudPalette";

export interface StanceDiamondsProps {
	stance: Stance;
	/** Fill of the diamonds (the team colour). */
	colour: string;
	/** Tip-to-tip size of one diamond, px. */
	size: number;
}

const ORDER: Stance[] = ["heaven", "earth"];
/** The cards' glyph colour on the diamonds — warm paper white. */
const GLYPH = "#e6e3d5";
/** Opacity of the stance NOT taken, as printed on the cards. */
const IDLE = 0.2;
/** Outline of the stance not taken, and its kanji's opacity. */
const OUTLINE = 0.75;
const GLYPH_IDLE = 0.7;

/**
 * The stance mark as printed on the cards: 天 and 地 each on a solid diamond in the team colour,
 * the stance taken at full strength, the other faded to a ghost. A change of stance cross-fades the
 * two and gives the new one a small stamp.
 */
export const StanceDiamonds = ({ stance, colour, size }: StanceDiamondsProps) => {
	const side = size / Math.SQRT2;
	return (
		// Stacked 天 over 地, tip to tip, as printed on the cards.
		<span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: size * 0.04 }}>
			{ORDER.map((s) => {
				const on = s === stance;
				return (
					<span key={s} style={{ position: "relative", display: "inline-grid", placeItems: "center", width: size, height: size }}>
						{/* Outline of the stance not taken — on the dark HUD corners the faded fill alone
						    vanishes and the kanji would float on its own. */}
						<motion.span
							initial={false}
							animate={{ opacity: on ? 0 : OUTLINE }}
							transition={{ duration: 0.35 }}
							style={{ position: "absolute", width: side, height: side, rotate: 45, boxShadow: `inset 0 0 0 ${Math.max(1, size * 0.05)}px ${colour}` }}
						/>
						<motion.span
							initial={false}
							animate={{ opacity: on ? 1 : IDLE, scale: on ? [0.82, 1.08, 1] : 1 }}
							transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
							style={{ position: "absolute", width: side, height: side, rotate: 45, background: colour }}
						/>
						<motion.span
							initial={false}
							animate={{ opacity: on ? 1 : GLYPH_IDLE }}
							transition={{ duration: 0.35 }}
							style={{
								position: "relative",
								color: GLYPH,
								fontFamily: '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", sans-serif',
								fontWeight: 700,
								fontSize: size * 0.44,
								lineHeight: 1,
								// CJK glyphs sit a touch high in their em box — nudge to the diamond's optical centre.
								y: size * 0.02,
							}}
						>
							{STANCE_LABEL[s].kanji}
						</motion.span>
					</span>
				);
			})}
		</span>
	);
};
