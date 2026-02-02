/**
 * Vitest configuration for obsidian-pa
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/*.d.ts", "src/__mocks__/**"],
      // Coverage thresholds - will fail CI if not met
      // Start low and increase as we add tests
      thresholds: {
        statements: 18,
        branches: 50,
        functions: 10,
        lines: 18,
      },
    },
    // Mock obsidian module since it's not available outside the Obsidian runtime
    alias: {
      obsidian: new URL("./src/__mocks__/obsidian.ts", import.meta.url).pathname,
    },
  },
});
