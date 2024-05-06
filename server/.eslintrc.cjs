module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  overrides: [
    {
      env: {
        node: true,
      },
      files: [ ".eslintrc.{js,cjs}" ],
      parserOptions: {
        sourceType: "script",
      },
    },
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: [
    "@typescript-eslint",
    "@stylistic"
  ],
  rules: {
    "@stylistic/indent": [ "warn",  2,        { VariableDeclarator: "first" } ],
    "@stylistic/quotes": [ "warn",  "double", { avoidEscape: true           } ],
    "@stylistic/semi":   [ "error", "always"                                  ],
  },
};
