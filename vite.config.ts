import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react(),
    cloudflare({
      inspectorPort: process.env.INTENTHOUR_E2E === "1" ? false : undefined,
    }),
  ],
  server: { port: 4317, strictPort: true },
  build: { sourcemap: true },
});
