import type { ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { useLang } from "../state/langPref";
import { MESSAGES } from "./messages";

/** react-intl provider bound to the player's language (`langPref`, the lobby's ITA | ENG switch). */
export const I18nProvider = ({ children }: { children: ReactNode }) => {
	const lang = useLang();
	return (
		<IntlProvider locale={lang} defaultLocale="it" messages={MESSAGES[lang]}>
			{children}
		</IntlProvider>
	);
};
