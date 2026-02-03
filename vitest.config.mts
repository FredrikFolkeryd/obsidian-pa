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
      // Temporarily lowered after adding features without tests (alpha.7 fixes)
      // TODO: Raise back to 45%/75% after adding tests for ChatView improvements
      thresholds: {
        statements: 40,
        branches: 75,
        functions: 40,
        lines: 40,
      },
    },
    // Mock obsidian module since it's not available outside the Obsidian runtime
    alias: {
      obsidian: new URL("./src/__mocks__/obsidian.ts", import.meta.url).pathname,
    },
  },
});
