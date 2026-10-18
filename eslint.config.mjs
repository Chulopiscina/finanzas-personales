import { FlatCompat } from "@eslint/eslintrc";
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });
const config = [
  { ignores: [".next/**", ".vercel/**", "node_modules/**", "work/**", "outputs/**", "coverage/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { rules: { "@typescript-eslint/no-explicit-any": "warn", "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }] } }
];
export default config;
