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
  {
    // Effect hooks are only imported directly in dedicated wrapper hooks.
    files: [
      "hooks/useMountEffect.ts",
      "hooks/useMountLayoutEffect.ts",
      "hooks/useReactiveEffect.ts",
      "hooks/useReactiveLayoutEffect.ts",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
];

export default eslintConfig;
