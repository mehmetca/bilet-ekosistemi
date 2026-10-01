import js from "@eslint/js";
import globals from "globals";
import pluginReact from "eslint-plugin-react";

export default [
  {
    files: ["**/*.{js,mjs,cjs,jsx}"],
    plugins: { js },
    rules: js.configs.recommended.rules,
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["src/app/api/**/*.{js,mjs,cjs}"],
    languageOptions: { globals: globals.node },
  },
  pluginReact.configs.flat.recommended,
];
