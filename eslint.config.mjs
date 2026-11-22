import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", ".dev-db/**", "playwright-report/**", "test-results/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { rules: { "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }] } },
  {
    files: ["**/*.mjs", "apps/web/public/**/*.js"],
    languageOptions: {
      globals: { process: "readonly", console: "readonly", self: "readonly", caches: "readonly", fetch: "readonly", URL: "readonly", Response: "readonly" },
    },
  },
);
