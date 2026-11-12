import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import react from "eslint-plugin-react";

export default [
  { ignores: [".next/**", "node_modules/**"] },
  js.configs.recommended,
  {
    files: ["app/**/*.{js,jsx}", "components/**/*.{js,jsx}", "lib/**/*.{js,mjs}"],
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        fetch: "readonly",
        Image: "readonly",
        ResizeObserver: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        window: "readonly",
        document: "readonly",
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
  {
    files: ["e2e/**/*.{js,mjs}"],
    languageOptions: { globals: { document: "readonly", innerWidth: "readonly" } },
  },
  {
    files: ["tests/**/*.{js,mjs}"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        fetch: "readonly",
        performance: "readonly",
      },
    },
  },
  {
    files: ["playwright.config.mjs"],
    languageOptions: { globals: { process: "readonly" } },
  },
];
