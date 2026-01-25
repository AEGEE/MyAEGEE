"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
const vitepress_1 = require("vitepress");
const recommended_1 = __importDefault(require("../../src/configs/recommended"));
const rulesForSidebar_1 = require("../.vitepress/rulesForSidebar");
exports.default = (0, vitepress_1.defineLoader)({
    load() {
        const recommended = getRecommendedRules();
        return rulesForSidebar_1.rules.map((rule) => ({
            name: rule.text,
            link: rule.link,
            recommended: recommended.includes(rule.text)
        }));
    }
});
function getRecommendedRules() {
    if (recommended_1.default.rules) {
        return Object.keys(recommended_1.default.rules).map(removeRulePrefix);
    }
    return [];
}
function removeRulePrefix(ruleName) {
    return ruleName.replace("vuejs-accessibility/", "");
}
