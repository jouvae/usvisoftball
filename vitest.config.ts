// Vitest — pure unit tests only (tests/unit). Playwright owns tests/e2e (playwright.config.ts).
// Aliases mirror tests/tsconfig.json: `@` → repo root, `server-only` → a no-op stub so
// server-only lib modules can be imported under Node.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL("./", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: root },
      { find: /^server-only$/, replacement: `${root}tests/support/server-only-stub.ts` },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
});
