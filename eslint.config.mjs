import tseslint from "typescript-eslint";

export default tseslint.config(
  // Global ignores (replaces ignorePatterns)
  // Config files are excluded: they use CommonJS/top-level-await patterns
  // that conflict with the TypeScript-checked source rules below
  {
    ignores: ["main.js", "node_modules/", "**/*.config.js", "**/*.config.mjs", "**/*.config.mts"],
  },

  // Base configs
  ...tseslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  // Main source rules
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
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

      // Allow console.warn/error for debugging, warn on console.log
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    },
  },

  // Relax strict type checking rules for test files
  // Mocking often involves any types which are unavoidable
  {
    files: ["**/*.test.ts", "**/*.spec.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
);
