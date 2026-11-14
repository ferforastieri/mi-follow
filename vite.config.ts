import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The library ships its TypeScript sources; Vite transforms them like the app's
// own files instead of pre-bundling them.
export default defineConfig({
  plugins: [react()],
  optimizeDeps: { exclude: ["faang-ui"] },
  server: {
    port: 5173,
    proxy: {
      // `npm run dev:api` serves the Worker on 8787; the dev server forwards /api.
      "/api": { target: "http://127.0.0.1:8787", changeOrigin: true },
    },
  },
  build: {
    target: "es2022",
    outDir: "dist",
    sourcemap: true,
  },
});
