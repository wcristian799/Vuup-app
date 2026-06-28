import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Use forks to avoid cross-realm Uint8Array issues with jose + better-sqlite3
    pool: "forks",
    environment: "node",
    include: ["src/test/**/*.test.ts"],
    env: {
      // Use in-memory SQLite for tests — isolated, no disk I/O, always clean
      DB_PATH: ":memory:",
    },
  },
});
