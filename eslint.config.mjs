import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default defineConfig([
  globalIgnores([
    "src/lib/vendor/",
    "src/tests/lib/vendor/",
    "tests/selenium/website_testbed/",
    "node_modules/",
  ]),
  {
    extends: compat.extends("eslint:recommended"),

    rules: {
      "array-callback-return": "error",
      "brace-style": ["error", "1tbs", {
        allowSingleLine: true,
      }],
      "consistent-this": ["error", "self"],
      "curly": "error",
      "dot-notation": "error",
      "eol-last": "error",
      "indent": ["error", 2],
      "keyword-spacing": "error",
      "linebreak-style": ["error", "unix"],
      "new-cap": "error",
      "no-array-constructor": "error",
      "no-bitwise": "error",
      "no-caller": "error",
      "no-eq-null": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-iterator": "error",
      "no-loop-func": "error",
      "no-multi-spaces": "error",
      "no-multi-str": "error",
      "no-new": "error",
      "no-new-func": "error",
      "no-new-object": "error",
      "no-new-wrappers": "error",
      "no-proto": "error",
      "no-script-url": "error",
      "no-shadow": "error",
      "no-shadow-restricted-names": "error",
      "no-tabs": "error",
      "no-trailing-spaces": "error",
      "no-unused-expressions": "error",
      "no-unused-vars": ["error", {
        caughtErrors: "none"
      }],
      //"no-var": "error",
      "preserve-caught-error": "off",
      "radix": "error",
      //"require-unicode-regexp": "error",
      "semi": "error",
      "space-before-blocks": "error",
      "space-in-parens": "error",
      "space-unary-ops": ["error", {
        words: true,
        nonwords: false,
      }],
    }
  },
  {
    files: ["scripts/**"],
    languageOptions: {
      globals: {
        ...globals.node,
      }
    }
  },
  {
    files: ["src/**"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.webextensions,
      },
      ecmaVersion: 2017
    }
  },
  {
    files: [
      "src/js/htmlutils.js",
      "src/js/options.js",
      "src/js/popup.js",
      "src/lib/i18n.js",
      "src/skin/**",
    ],
    languageOptions: {
      globals: {
        ...globals.jquery,
      }
    }
  },
  {
    files: ["src/js/contentscripts/**"],
    rules: {
      "indent": ["error", 2, {
        outerIIFEBody: 0
      }]
    }
  },
  {
    files: ["src/data/web_accessible_resources/**"],
    languageOptions: {
      sourceType: "script"
    },
    rules: {
      "indent": ["error", 4, {
        outerIIFEBody: 1
      }],
      "keyword-spacing": "off",
      "no-bitwise": "off",
      "no-empty": "off",
      "no-extra-semi": "off",
      "space-in-parens": "off",
    }
  },
  {
    files: ["src/tests/**"],
    languageOptions: {
      globals: {
        ...globals.jquery,
        badger: "readonly",
        QUnit: "readonly",
        sinon: "readonly"
      }
    }
  }
]);
