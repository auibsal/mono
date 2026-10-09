import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["cobertura"],
      reportsDirectory: "./coverage",
    },
    projects: [
      "apps/app",
      "apps/api",
      "apps/storybook",
      "packages/analytics",
      "packages/collaboration",
      "packages/storage",
      "packages/auth",
      "packages/config",
      "packages/sal-data",
      "packages/design-system",
      "packages/rbac",
      "packages/internationalization",
      "packages/next-config",
    ],
  },
});
