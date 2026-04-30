import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: false,
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
  },
});
