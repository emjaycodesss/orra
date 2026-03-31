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
    // ShufflePhase — GSAP DOM sync; SpreadPhase — deal phase opens with layout-time audio kick.
    files: ["components/reading/ShufflePhase.tsx", "components/reading/SpreadPhase.tsx"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    files: ["components/reading/ReadingAudioProvider.tsx"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    // Orbit canvas must attach before paint; shell registers bindings before paint to avoid ENTER flicker.
    files: ["components/reading/ReadingOrbitLayer.tsx", "components/reading/ReadingOrbitShell.tsx"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
];

export default eslintConfig;
