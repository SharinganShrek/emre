import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // These React Compiler rules flag intentional, correct patterns in this
    // codebase: (1) client-only localStorage hydration, which cannot run in a
    // useState initializer because that also executes during SSR, and (2)
    // re-initializing modal form state when a dialog opens. Relaxing them keeps
    // the lint signal useful without fighting valid idioms.
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
]);

export default eslintConfig;
