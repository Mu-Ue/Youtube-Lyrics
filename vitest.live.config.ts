import { defineConfig } from "vitest/config";

/** Live tests hit real websites; run them with `npm run test:live`. */
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/live/**/*.live.test.ts"],
    testTimeout: 30_000,
  },
});
