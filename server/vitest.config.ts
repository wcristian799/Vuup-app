import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Use vmThreads to avoid cross-realm Uint8Array issues with jose
    pool: "forks",
    environment: "node",
    include: ["src/test/**/*.test.ts"],
  },
});
