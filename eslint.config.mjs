import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * NusaPOS — ESLint flat config (Next.js 16 + ESLint 9).
 *
 * Project ini TIDAK memakai React Compiler, jadi rule dari pipeline validasi
 * compiler dimatikan: set-state-in-effect, purity, immutability.
 * YANG TETAP ERROR: react-hooks/rules-of-hooks, prefer-const, no-undef, dll.
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",

      "@next/next/no-img-element": "off",
      "react/no-unescaped-entities": "off",
      "@next/next/no-html-link-for-pages": "warn",

      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    /* Script tooling & config jalan di Node, bukan browser. */
    files: ["scripts/**/*.mjs", "*.config.mjs", "*.config.ts"],
    languageOptions: {
      globals: { console: "readonly", process: "readonly", Buffer: "readonly", URL: "readonly" },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "node_modules/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;