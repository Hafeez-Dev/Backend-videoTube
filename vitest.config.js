import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    globalSetup: ["./tests/global-setup.js"],
    setupFiles: ["./tests/setup.js"],
    coverage: {
      reporter: ["text", "json", "html"]
    }
  }
});