"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rules_1 = require("./rules");
const recommended = {
    parser: require.resolve("vue-eslint-parser"),
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module"
    },
    env: {
        browser: true,
        es6: true
    },
    plugins: ["vuejs-accessibility"],
    rules: rules_1.rules
};
exports.default = recommended;
