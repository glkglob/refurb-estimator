import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

/** @type {import("eslint").Linter.Config[]} */
const config = [
  // ── Next.js + TypeScript recommended rules ──
  ...compat.extends(
    "next/core-web-vitals",
    "next/typescript",
  ),

  // ── Project overrides ──
  {
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
      "raycast-extension/**",
      "supabase/**",
      "*.config.*",
    ],
  },
];

export default config;
