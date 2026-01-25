"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const aria_query_1 = require("aria-query");
const utils_1 = require("../utils");
function isInteractiveRole(value) {
    if (typeof value !== "string") {
        return false;
    }
    return value
        .toLowerCase()
        .split(" ")
        .some((role) => aria_query_1.roles.has(role) && (0, utils_1.getInteractiveRoles)().includes(role));
}
exports.default = isInteractiveRole;
