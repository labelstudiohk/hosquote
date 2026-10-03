import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: { rollupOptions: { input: { main: "index.html", staff: "staff.html" } } },
  server: {
    port: 3000,
    proxy: {
      "/api": "http://127.0.0.1:3001",
    },
  },
});
