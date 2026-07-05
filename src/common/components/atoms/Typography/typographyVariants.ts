import { tv, type VariantProps } from "tailwind-variants";

export const typographyVariants = tv({
	// Hirokawa is the project's primary face (registered as `font-sans` in index.css).
	base: "font-sans font-normal text-white",
	variants: {
		variant: {
			// Titles use the Genjiro display face (registered as `font-display` in index.css).
			// Oversized victory / splash title.
			display: "font-display text-[clamp(48px,12vw,140px)] leading-none tracking-[0.08em] uppercase",
			"page-title": "font-display text-[33px] leading-normal tracking-[0.04em]",
			"page-subtitle": "text-[17px] font-light italic leading-normal",
			"section-label": "text-[14px] uppercase tracking-[2px] leading-normal",
			"button-action": "text-[16px] font-bold leading-normal",
			button: "text-[16px] leading-normal",
			body: "text-[16px] leading-normal",
		},
		color: {
			light: "text-white",
			muted: "text-white/60",
			dark: "text-black",
			red: "text-[#d8303d]",
			blue: "text-[#579cb1]",
		},
	},
	defaultVariants: {
		variant: "body",
		color: "light",
	},
});

export type TypographyVariants = VariantProps<typeof typographyVariants>;
export type Variant = NonNullable<TypographyVariants["variant"]>;
