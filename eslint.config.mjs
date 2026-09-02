import js from "@eslint/js";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
    globalIgnores([
        "node_modules/*",
        "dist/*",
        "logs/*",
        "prisma/*",
        "generated/*",
        "scripts.sh",
        "*.sh",
        "scripts/*",
    ]),
    {
        files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
        plugins: { js },
        extends: ["js/recommended", ...tseslint.configs.recommended, "plugin:prettier/recommended"],
        languageOptions: {
            globals: { ...globals.browser, ...globals.node },
        },
        rules: {
            "no-useless-catch": "off",
            "no-console": ["warn", { allow: ["warn", "error", "info", "group", "groupEnd"] }],
            "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
            "no-unused-expressions": "error",
            "no-undef": "off",
            "@typescript-eslint/no-empty-object-type": "warn",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-namespace": "warn",
        },
    },
    eslintPluginPrettierRecommended,
]);
