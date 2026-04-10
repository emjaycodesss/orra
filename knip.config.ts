import type { KnipConfig } from "knip";

/**
 * Dead-code analysis: Next.js + Vitest are auto-detected from package.json.
 * scripts/*.mjs are CLI entry points, not imported by the app.
 *
 * ignoreDependencies: packages used outside the TS graph (Foundry remappings,
 * Next/ESLint CLI) so Knip does not flag them as unused npm deps.
 */
const config: KnipConfig = {
  entry: ["scripts/**/*.mjs"],
  ignoreDependencies: [
    "@pythnetwork/entropy-sdk-solidity",
    "eslint",
    "eslint-config-next",
  ],
};

export default config;
