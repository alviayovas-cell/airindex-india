import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        // Backend dev server (see backend/run_dev.py). Override with VITE_API_PROXY.
        target: process.env.VITE_API_PROXY || "http://localhost:8010",
        changeOrigin: true,
      },
    },
  },
});
