const path = require("path");

module.exports = {
    env: {
        browser: true,
        es2021: true,
    },
    extends: [
        "eslint:recommended",
        "plugin:react/recommended",
        "plugin:@typescript-eslint/recommended",
        "airbnb",
        "airbnb/hooks",
        "airbnb-typescript",
        "plugin:@next/next/recommended",
        "prettier",
    ],
    parser: "@typescript-eslint/parser",
    parserOptions: {
        ecmaFeatures: {
            jsx: true,
        },
        ecmaVersion: "latest",
        sourceType: "module",
        project: path.resolve(__dirname, "tsconfig.eslint.json"),
    },
    plugins: ["react", "@typescript-eslint", "prettier"],
    // IMPORTANT We've chosen to follow the these rules to provider a reasonable set of base rules.
    // We may decide to disable rules that we don't think are vaulable. If so, ensure you leave a comment
    // above the rule for your reasoning, in order to explain to future readers why that decision was made.
    rules: {
        // Next.js does this for us so no need to add the import
        "react/react-in-jsx-scope": "off",
        // enforce consistent function defintion
        "react/function-component-definition": [
            "error",
            {
                namedComponents: "arrow-function",
                unnamedComponents: "arrow-function",
            },
        ],
        // TODO: Assess use of ExplicitAny
        "@typescript-eslint/no-explicit-any": "error",
        // Once we have refactored the codebase and written tests, activate this to reduce code complexity
        // "react/jsx-max-depth": ["error", { "max": 4 }]
    },
    overrides: [
        {
            // Exclude configuration files from TypeScript rules
            files: ["*.config.js", ".eslintrc.js"],
            parserOptions: {
                project: null,
            },
        },
        {
            // We can use "NextPage<Props>" with Next pages and this rule does not pick that up
            files: ["./src/pages/**"],
            rules: { "react/prop-types": "off" },
        },
    ],
    settings: {
        "import/resolver": {
            typescript: {
                project: "./tsconfig.eslint.json",
            },
        },
    },
};

// {
//     "env": {
//         "browser": true,
//         "es2021": true
//     },
//     "extends": [
//         "eslint:recommended",
//         "plugin:react/recommended",
//         "plugin:@typescript-eslint/recommended",
//         "airbnb",
//         "airbnb/hooks",
//         "airbnb-typescript",
//         "plugin:@next/next/recommended",
//         "prettier"
//     ],
//     "parser": "@typescript-eslint/parser",
//     "parserOptions": {
//         "ecmaFeatures": {
//             "jsx": true
//         },
//         "ecmaVersion": "latest",
//         "sourceType": "module",
//         "project": "./packages/frontend/tsconfig.eslint.json",
//         "tsconfigRootDir": "./"
//     },
//     "plugins": ["react", "@typescript-eslint", "prettier"],
//     // ***IMPORTANT*** We've chosen to follow the these rules to provider a reasonable set of base rules.
//     // We may decide to disable rules that we don't think are vaulable. If so, ensure you leave a comment
//     // above the rule for your reasoning, in order to explain to future readers why that decision was made.
//     "rules": {
//         // Next.js does this for us so no need to add the import
//         "react/react-in-jsx-scope": "off",
//         // enforce consistent function defintion
//         "react/function-component-definition": [
//             "error",
//             {
//                 "namedComponents": "arrow-function",
//                 "unnamedComponents": "arrow-function"
//             }
//         ],
//         // TODO: Assess use of ExplicitAny
//         "@typescript-eslint/no-explicit-any": "error"
//         // Once we have refactored the codebase and written tests, activate this to reduce code complexity
//         // "react/jsx-max-depth": ["error", { "max": 4 }]
//     },
//     "overrides": [
//         {
//             // We can use "NextPage<Props>" with Next pages and this rule does not pick that up
//             "files": ["./src/pages/**"],
//             "rules": { "react/prop-types": "off" }
//         }
//     ],
//     "settings": {
//         "import/resolver": {
//             "typescript": {
//                 "project": "./tsconfig.eslint.json"
//             }
//         }
//     }
// }
