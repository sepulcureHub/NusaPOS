import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * NusaPOS — ESLint flat config (Next.js 16 + ESLint 9).
 *
 * Catatan penting: Next.js 16 mengaktifkan aturan React Compiler
 * (react-hooks/set-state-in-effect, purity, immutability) secara default.
 * Aturan ini HANYA relevan kalau project memakai React Compiler
 * (babel-plugin-react-compiler / compiler flag). Project ini TIDAK memakainya,
 * jadi aturan ini dimatikan untuk menghindari false positive —
 * kode di bawah ini valid dan bekerja normal di React 19 biasa.
 *
 * Bug nyata (conditional hooks, variable reassign setelah render, prefer-const)
 * tetap dijaga dan harus diperbaiki di tiap file.
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // ── Disable aturan React Compiler (tidak relevan, project tidak memakainya) ──
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",

      // ── Foto produk & logo disimpan sebagai data URL (base64) di localStorage.
      // next/image tidak mengoptimalkan data URL, jadi <img> memang tepat di sini.
      "@next/next/no-img-element": "off",

      // ── Banyak teks UI Bahasa Indonesia memakai tanda kutip langsung.
      "react/no-unescaped-entities": "off",

      // ── Sebagian navigasi internal masih pakai <a> (mis. header portal member).
      "@next/next/no-html-link-for-pages": "warn",

      // ── Baseline: import/variabel nganggur = warning, bukan error.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/exhaustive-deps": "warn",
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