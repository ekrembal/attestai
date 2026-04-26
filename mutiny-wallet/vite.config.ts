import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  define: {
    global: "globalThis",
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      buffer: "buffer",
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    setupFiles: "./src/vitest.setup.ts",
  },
})
