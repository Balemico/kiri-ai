import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";

// P2P multiplayer (Trystero) uses the Web Crypto API, which is only available in a SECURE CONTEXT.
// `http://localhost` / `http://127.0.0.1` already count as secure, but a LAN IP or hostname over
// plain HTTP does NOT — so testing across two devices needs HTTPS. Run `HTTPS=true yarn dev` (or
// `yarn dev:https`) to serve over HTTPS with an auto-generated self-signed cert (accept it once).
const https = process.env.HTTPS === "true";

// https://vite.dev/config/
export default defineConfig({
	plugins: [react(), tailwindcss(), ...(https ? [basicSsl()] : [])],
});
