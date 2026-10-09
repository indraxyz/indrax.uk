import js from "@eslint/js"
import ts from "typescript-eslint"
import hooks from "eslint-plugin-react-hooks"
import globals from "globals"
export default ts.config(
  {
    ignores: [
      "node_modules/**",
      "public/admin/**",
      "build/**",
      ".react-router/**",
      ".next/**",
      ".open-next/**",
      ".wrangler/**",
      "playwright-report/**",
      "test-results/**",
      "cloudflare-env.d.ts",
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": hooks },
    rules: { "react-hooks/rules-of-hooks": "error", "react-hooks/exhaustive-deps": "warn" },
  }
)
