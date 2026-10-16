import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "file:./test.db",
      JWT_SECRET: "test-secret-at-least-16-chars",
    },
    globalSetup: ["./test/global-setup.ts"],
    // All test files share one SQLite file.
    fileParallelism: false,
  },
});
