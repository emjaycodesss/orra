import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals"),
  {
    rules: {
      "no-console": "error",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react",
              importNames: ["useEffect", "useLayoutEffect", "useInsertionEffect"],
              message:
                "Effect hooks are banned in this codebase. Use store-driven subscriptions and derived state instead.",
            },
          ],
        },
      ],
    },
  },
  // Legacy/env-gated logging; prefer structured helpers in new code.
  {
    files: [
      "lib/api-observability.ts",
      "lib/dev-warn.ts",
      "scripts/**/*.mjs",
      "app/api/interpret/route.ts",
    ],
    rules: {
      "no-console": "off",
    },
  },
  {
    // Effect hooks are only imported directly in dedicated wrapper hooks.
    files: [
      "hooks/useMountEffect.ts",
      "hooks/useReactiveEffect.ts",
      "hooks/useReactiveLayoutEffect.ts",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
];

export default eslintConfig;
