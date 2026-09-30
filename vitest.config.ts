import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
    // Live tests need the network; they run through vitest.live.config.ts.
    exclude: ["tests/live/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      reporter: ["text-summary", "text", "lcov"],
      // Deliberately modest: a floor that catches regressions, not a target to game.
      thresholds: {
        statements: 70,
        lines: 70,
        functions: 65,
        branches: 60,
      },
    },
  },
});
