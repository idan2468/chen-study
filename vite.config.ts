import react from "@vitejs/plugin-react"
import * as path from "node:path"
import { defineConfig } from "vitest/config"
import packageJson from "./package.json" with { type: "json" }

// https://vitejs.dev/config/
export default defineConfig({
  // Pages serves from https://idan2468.github.io/chen-study/, a sub-path --
  // without this every asset request 404s.
  base: "/chen-study/",

  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@test": path.resolve(import.meta.dirname, "test"),
    },
  },

  server: {
    open: true,
  },

  test: {
    root: import.meta.dirname,
    name: packageJson.name,
    environment: "jsdom",

    typecheck: {
      enabled: true,
      tsconfig: path.join(import.meta.dirname, "tsconfig.json"),
    },

    globals: true,
    watch: false,
    setupFiles: ["./test/setup.ts"],
    // The speechSynthesis/clipboard stubs in test/setup.ts are shared mock
    // objects; without this their call history (`toHaveBeenCalled...`) would
    // leak between tests instead of resetting each time.
    restoreMocks: true,
  },
})
