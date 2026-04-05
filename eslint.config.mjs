import { defineConfig } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import reactPlugin from "eslint-plugin-react";

const config = defineConfig([
  ...nextCoreWebVitals,
  ...nextTypescript,

  // ── Project overrides ──
  {
    plugins: {
      react: reactPlugin,
    },
    rules: {
      // TypeScript strict — no untyped escape hatches
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // Import hygiene
      "no-duplicate-imports": "error",

      // React best practices
      "react/self-closing-comp": "error",
      "react/jsx-no-leaked-render": "warn",

      // General code quality
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prefer-const": "error",
      "no-var": "error",
      "eqeqeq": ["error", "always"],
      "curly": ["error", "multi-line"],
    },
  },

  // ── Ignore patterns ──
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "coverage/**",
      "refurb-estimator/**",
      "supabase/**",
      "*.config.*",
    ],
  },
]);

export default config;
