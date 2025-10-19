import eslintJs from "@eslint/js";
import eslintTs from "typescript-eslint";

export default [
  eslintJs.configs.recommended,
  ...eslintTs.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["**/*.js"],
    ...eslintTs.configs.disableTypeChecked,
  },
  {
    ignores: ["node_modules/**", "dist/**", "*.config.ts"],
  },
];
