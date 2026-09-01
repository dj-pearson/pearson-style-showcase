import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11y from "eslint-plugin-jsx-a11y";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "coverage",
      "e2e-results",
      ".lighthouseci",
      "danpearson-edge-functions",
      "edge-functions-template",
      "supabase",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "jsx-a11y": jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Accessibility rules run as warnings: the codebase has a real backlog
      // (128 <Label> elements carry no htmlFor, so their control has no
      // accessible name) and erroring would block every commit before that is
      // worked down. Warnings keep the count visible in `npm run lint` and in
      // CI without gating. Tighten to "error" once the backlog is cleared.
      ...Object.fromEntries(
        Object.keys(jsxA11y.configs.recommended.rules).map((rule) => [rule, "warn"])
      ),
      // Deprecated upstream and duplicates label-has-associated-control, which
      // reports the same 49 controls with a usable message.
      "jsx-a11y/label-has-for": "off",
      // Off after auditing all 17 of its reports. The rule inspects an element's
      // own subtree and cannot follow htmlFor to a matching id on a sibling, which
      // is the dominant correct pattern here: `<input id="is_active" />` next to
      // `<Label htmlFor="is_active">`. Fourteen of the seventeen were correctly
      // labelled that way. It did catch two real ones (an unlabelled <video> in
      // MediaLibrary and a hidden file input in BulkImportDialog), both since
      // fixed, but it will flag every new correctly-labelled control the same way,
      // so leaving it on buries real findings. Mapping Label via the components
      // setting makes it worse, not better: it took the count from 16 to 281.
      "jsx-a11y/control-has-associated-label": "off",
      // onLoad and onError are in this rule's default handler list, so every
      // lazy-loaded <img> that tracks its own load state trips it. Those are not
      // user interactions and carry no keyboard expectation. Narrowed to the
      // handlers that do, rather than switching the rule off.
      "jsx-a11y/no-noninteractive-element-interactions": [
        "warn",
        {
          handlers: ["onClick", "onMouseDown", "onMouseUp", "onKeyPress", "onKeyDown", "onKeyUp"],
        },
      ],
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Explicit options are required: the @typescript-eslint wrapper reads the
      // base rule's options and throws if none are provided.
      "@typescript-eslint/no-unused-expressions": [
        "warn",
        { allowShortCircuit: true, allowTernary: true, allowTaggedTemplates: true },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    // Playwright E2E files are not React. The `use` fixture parameter is a
    // Playwright convention, not the React `use` hook, so the react-hooks
    // rules produce false positives here.
    files: ["e2e/**/*.{ts,tsx}"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  }
);
