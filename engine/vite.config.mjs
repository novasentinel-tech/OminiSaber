import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createStudioRelease, studioReleasePlugin } from './scripts/studio-release.mjs';

const release = createStudioRelease({ buildId: process.env.OMINISTUDIO_BUILD_ID });

export default defineConfig({
  base: "./",
  define: { __OMINISTUDIO_BUILD__: JSON.stringify(release) },
  build: {
    outDir: "dist/client",
    rollupOptions: { output: { manualChunks: { 'math-notation': ['katex'] } } },
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    proxy: { '/backend': { target: 'http://127.0.0.1:4173' }, '/frontend': { target: 'http://127.0.0.1:4173' } },
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react(), studioReleasePlugin(release)],
});
