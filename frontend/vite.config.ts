/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const API = "http://localhost:4000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Same-origin in dev so the httpOnly cookie works for both REST and Socket.IO.
    proxy: {
      "/api": API,
      "/socket.io": { target: API, ws: true },
    },
  },
  test: {
    environment: "node",
  },
});
