import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 5180,
    allowedHosts: ["terminal.local"],
    proxy: {
      "/api": "http://localhost:4100",
      "/socket.io": { target: "http://localhost:4100", ws: true },
    },
  },
});
