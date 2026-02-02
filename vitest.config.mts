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
      // Sprint 3 target: 45% statements, 75% branches (up from 35%/70%)
      // Increase by ~10% per sprint until 75%+ for 1.0
      thresholds: {
        statements: 45,
        branches: 75,
        functions: 40,
        lines: 45,
      },
    },
    // Mock obsidian module since it's not available outside the Obsidian runtime
    alias: {
      obsidian: new URL("./src/__mocks__/obsidian.ts", import.meta.url).pathname,
    },
  },
});
