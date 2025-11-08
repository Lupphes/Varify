import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./tests/js/setup.js"],
    include: ["tests/js/**/*.test.js", "tests/js/**/*.spec.js"],

    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/varify/assets/js/**/*.js"],
      exclude: [
        "src/varify/assets/js/bundle.js",
        "src/varify/assets/js/index.js",
        "**/node_modules/**",
        "**/tests/**",
      ],
      thresholds: {
        lines: 30,
        functions: 29,
        branches: 30,
        statements: 30,
      },
    },

    testTimeout: 10000,
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    threads: true,
    maxThreads: 4,
    reporter: ["verbose", "html"],

    alias: {
      "@": resolve(__dirname, "./src/varify/assets/js"),
      "@tests": resolve(__dirname, "./tests/js"),
    },
  },

  resolve: {
    alias: {
      "@": resolve(__dirname, "./src/varify/assets/js"),
      "@tests": resolve(__dirname, "./tests/js"),
    },
  },
});
