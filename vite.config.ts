import { defineConfig } from "vite";

export default defineConfig({
  base: "/trace-rush/",
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
