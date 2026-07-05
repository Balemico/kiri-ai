import { Analytics } from "@vercel/analytics/react";
import { SessionProvider } from "./common/net";
import { AppRoot } from "./AppRoot";

function App() {
	return (
		<SessionProvider>
			<AppRoot />
			<Analytics />
		</SessionProvider>
	);
}

export default App;
