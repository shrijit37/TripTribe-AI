import js from "@eslint/js";
import globals from "globals";
import next from "eslint-config-next";

const config = [
  { ignores: [".next/**", "node_modules/**", "dist/**", "out/**", "next-env.d.ts"] },
  js.configs.recommended,
  ...next,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      // `@types/google.maps` declares `google` as an ambient namespace with no
      // global value, so ESLint cannot see it even though TypeScript resolves
      // it. Declaring it here keeps `no-undef` honest about what the rest of
      // the rules catch.
      globals: { ...globals.browser, ...globals.node, google: "readonly" },
    },
    rules: {
      // The ported components keep their original inline icon/illustration SVG
      // markup, which this rule would otherwise flood with warnings.
      "@next/next/no-img-element": "off",
      // `react-hooks/set-state-in-effect` fires on the session-storage and
      // plan-claim reads that were `location.state` before. Those reads are
      // client-only by nature — `sessionStorage` does not exist during the
      // server render — so the claim genuinely has to happen after mount. The
      // rule's advice (derive during render) cannot apply to a value that is
      // unknowable until the client runs.
      "react-hooks/set-state-in-effect": "off",
      // Unused bindings are `tsc`'s job. The base rule cannot read TypeScript,
      // so it reports type members (`onError?: (message: string) => void`) and
      // ambient declarations as unused variables. `noUnusedLocals` and
      // `noUnusedParameters` catch the real ones — including the `_` prefix
      // convention — and are enforced by `npm run typecheck`.
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];

export default config;