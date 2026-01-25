"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const getElementAttributeValue_1 = __importDefault(require("./getElementAttributeValue"));
function isPresentationRole(node) {
    const role = (0, getElementAttributeValue_1.default)(node, "role");
    return role === "presentation" || role === "none";
}
exports.default = isPresentationRole;
