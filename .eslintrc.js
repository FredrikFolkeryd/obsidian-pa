module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: "module",
    project: "./tsconfig.json",
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
  ],
  env: {
    browser: true,
    node: true,
    es6: true,
  },
  rules: {
    // TypeScript handles these
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],

    // Require explicit return types on public methods
    "@typescript-eslint/explicit-function-return-type": [
      "error",
      {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
        allowHigherOrderFunctions: true,
      },
    ],

    // Require explicit member accessibility
    "@typescript-eslint/explicit-member-accessibility": [
      "error",
      { accessibility: "explicit" },
    ],

    // Prefer interface over type for object definitions
    "@typescript-eslint/consistent-type-definitions": ["error", "interface"],

    // No floating promises
    "@typescript-eslint/no-floating-promises": "error",

    // No misused promises
    "@typescript-eslint/no-misused-promises": "error",

    // Require await in async functions
    "@typescript-eslint/require-await": "error",

    // Allow console for debugging (can be stricter in production)
    "no-console": "warn",
  },
  ignorePatterns: ["main.js", "node_modules/", "*.config.js", "*.config.mjs"],
};
