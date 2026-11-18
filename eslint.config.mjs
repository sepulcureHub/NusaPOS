import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * NusaPOS — ESLint flat config (Next.js 16 + ESLint 9).
 *
 * Project ini TIDAK memakai React Compiler (babel-plugin-react-compiler / flag compiler).
 * Karena itu rule yang berasal dari pipeline validasi compiler dimatikan:
 *   - set-state-in-effect : setState di effect adalah pola hydrate yang sah
 *   - purity              : Date.now()/Math.random() di render demo memang dipakai
 *   - immutability        : menulis DOM di event handler & akumulator lokal di .map()
 *                           itu sah tanpa compiler (false positive)
 *
 * YANG TETAP ERROR DAN TIDAK BOLEH DIMATIKAN:
 *   - react-hooks/rules-of-hooks  → bug nyata (hook dipanggil kondisional)
 *   - prefer-const, no-undef, dll → bug nyata
 * Kalau nanti project mengaktifkan React Compiler, hidupkan lagi tiga rule di bawah.
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // ── Rule khusus React Compiler (tidak relevan di project ini) ──
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",

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