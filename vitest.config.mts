import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "tests/empty.ts"),
    },
  },
  test: {
    env: {
      MONGODB_URI: process.env.TEST_MONGODB_URI ?? "mongodb://127.0.0.1:27018/varad_test?replicaSet=rs0&directConnection=true",
      BETTER_AUTH_SECRET: "test-only-secret-not-used-anywhere-else-0123",
    },
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
