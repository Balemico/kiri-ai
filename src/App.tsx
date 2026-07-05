import { SessionProvider } from "./common/net";
import { AppRoot } from "./AppRoot";

function App() {
	return (
		<SessionProvider>
			<AppRoot />
		</SessionProvider>
	);
}

export default App;
