"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const aria_query_1 = require("aria-query");
function getInteractiveRoles() {
    const interactiveRoles = [];
    for (const [role, definition] of aria_query_1.roles.entries()) {
        if (!definition.abstract &&
            definition.superClass.some((classes) => classes.includes("widget"))) {
            interactiveRoles.push(role);
        }
    }
    return interactiveRoles;
}
exports.default = getInteractiveRoles;
