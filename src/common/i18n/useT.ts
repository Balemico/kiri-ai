import { useCallback } from "react";
import { useIntl } from "react-intl";
import type { PrimitiveType } from "react-intl";
import type { MessageId } from "./messages";

/**
 * Typed `formatMessage` shorthand: `t("menu.passAndPlay")`, `t("win.tally", { rounds, lives })`.
 * Stable until the language changes (the provider's `intl` object is), so it's a safe memo dep.
 */
export const useT = () => {
	const intl = useIntl();
	return useCallback((id: MessageId, values?: Record<string, PrimitiveType>): string => intl.formatMessage({ id }, values), [intl]);
};
