import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./"),
      "@repo": path.resolve(import.meta.dirname, "../../packages"),
    },
  },
  test: {
    environment: "jsdom",
    // next-intl imports "next/navigation" without an extension, which only
    // resolves when Vite bundles it (and lets the setup file mock it).
    server: { deps: { inline: ["next-intl"] } },
    setupFiles: ["./__tests__/setup.ts"],
  },
});
