import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  server: {
    port: 5173,
    // Fail loudly instead of moving to 5174, which would break the backend CORS origin.
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:3010",
        changeOrigin: true,
      },
      // Uploaded product images are served by the backend at /uploads (outside /api/v1).
      "/uploads": {
        target: "http://localhost:3010",
        changeOrigin: true,
      },
    },
  },
});
