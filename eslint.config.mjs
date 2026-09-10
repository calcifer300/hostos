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

    // The Companion extension is MV3 browser source, not part of the Next
    // app. Its files share one global scope through importScripts() and
    // <script> tags, so every cross-file function reads as unused here —
    // 49 warnings, none of them real. It has no TypeScript, no JSX and no
    // React, so the Next config has nothing useful to say about it either.
    "extension/**",
  ]),
]);

export default eslintConfig;
