"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const hasOnDirective_1 = __importDefault(require("./hasOnDirective"));
function hasOnDirectives(node, names) {
    return names.some((name) => (0, hasOnDirective_1.default)(node, name));
}
exports.default = hasOnDirectives;
