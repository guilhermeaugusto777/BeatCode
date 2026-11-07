import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import react from "eslint-plugin-react";

export default [
  { ignores: [".next/**", "node_modules/**"] },
  js.configs.recommended,
  {
    files: ["app/**/*.{js,jsx}", "components/**/*.{js,jsx}"],
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        fetch: "readonly",
        Image: "readonly",
        ResizeObserver: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        process: "readonly",
      },
    },
    plugins: { "react-hooks": reactHooks, react },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react/jsx-uses-vars": "error",
      "react/jsx-uses-react": "error",
      // The existing graph effect resets loading before each fetch; revisit with the UI rewrite.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["tailwind.config.js"],
    languageOptions: { globals: { module: "readonly" } },
  },
];
