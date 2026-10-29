import { Analytics } from "@vercel/analytics/react";
import { SessionProvider } from "./common/net";
import { I18nProvider } from "./common/i18n";
import { AppRoot } from "./AppRoot";

function App() {
	return (
		<I18nProvider>
			<SessionProvider>
				<AppRoot />
				<Analytics />
			</SessionProvider>
		</I18nProvider>
	);
}

export default App;
