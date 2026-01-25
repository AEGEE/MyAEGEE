"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function makeKebabCase(value) {
    return value
        .replace(/_/gu, "-")
        .replace(/\B([A-Z])/gu, "-$1")
        .toLowerCase();
}
exports.default = makeKebabCase;
