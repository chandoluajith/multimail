/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      ".wrangler/**",
      "tsconfig.app.tsbuildinfo",
      "tsconfig.node.tsbuildinfo",
      "lint_output.txt",
    ],
  },
];
