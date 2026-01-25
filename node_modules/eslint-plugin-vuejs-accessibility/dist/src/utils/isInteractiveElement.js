"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const aria_query_1 = require("aria-query");
const getElementType_1 = __importDefault(require("./getElementType"));
const matchesElementRole_1 = __importDefault(require("./matchesElementRole"));
// "toolbar" does not descend from widget, but it does support
// aria-activedescendant, thus in practice we treat it as a widget.
const interactiveRoles = new Set(["toolbar"]);
for (const [name, definition] of aria_query_1.roles.entries()) {
    if (!definition.abstract &&
        definition.superClass.some((classes) => classes.includes("widget"))) {
        interactiveRoles.add(name);
    }
}
// We need to explicitly list that plain inputs are interactive, even if they
// don't have an explicit role.
const interactiveElements = [{ name: "input" }];
for (const [element, names] of aria_query_1.elementRoles.entries()) {
    if ([...names].some((name) => interactiveRoles.has(name))) {
        interactiveElements.push(element);
    }
}
function isInteractiveElement(node) {
    const elementType = (0, getElementType_1.default)(node);
    if (!aria_query_1.dom.has(elementType)) {
        return false;
    }
    return interactiveElements.some((elementRole) => (0, matchesElementRole_1.default)(node, elementRole));
}
exports.default = isInteractiveElement;
