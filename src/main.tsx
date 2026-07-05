import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Note: StrictMode is intentionally omitted — its dev double-mount restarts the
// imperative gsap card animations mid-flight, causing a visible hitch.
createRoot(document.getElementById("root")!).render(<App />);
