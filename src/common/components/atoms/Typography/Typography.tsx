import type { CSSProperties, ElementType, ReactNode } from "react";
import { typographyVariants, type TypographyVariants, type Variant } from "./typographyVariants";

/** Any host tag / component that accepts a className and children. */
type TextTag = ElementType<{ className?: string; style?: CSSProperties; children?: ReactNode }>;

interface Props extends TypographyVariants {
	children: ReactNode;
	className?: string;
	style?: CSSProperties;
	as?: TextTag;
}

const tags: Record<Variant, TextTag> = {
	display: "h1",
	"page-title": "h1",
	"page-subtitle": "p",
	"section-label": "p",
	"button-action": "span",
	button: "span",
	body: "p",
};

export const Typography = ({ variant = "body", color, children, className, style, as }: Props) => {
	const Tag: TextTag = as ?? tags[variant];

	const finalClasses = typographyVariants({
		variant,
		color,
		className,
	});

	return (
		<Tag className={finalClasses} style={style}>
			{children}
		</Tag>
	);
};
