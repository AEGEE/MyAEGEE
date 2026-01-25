"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const aria_query_1 = require("aria-query");
const utils_1 = require("../utils");
const exceptions = { nav: ["navigation"] };
function getImplicitRoleSet(node) {
    const matchingRoles = aria_query_1.elementRoles
        .entries()
        .filter(([consept]) => {
        return (0, utils_1.matchesElementRole)(node, consept);
    })
        .sort(([a], [b]) => {
        var _a, _b, _c, _d;
        // try ordering by the concept that is more difficult to match first.
        // the number of attributes needed to "match" is used here as a proxy of
        // that difficulty.
        return ((_b = (_a = b.attributes) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0) - ((_d = (_c = a.attributes) === null || _c === void 0 ? void 0 : _c.length) !== null && _d !== void 0 ? _d : 0);
    });
    const [preferedRole] = matchingRoles;
    const [, roleSet = null] = preferedRole || [];
    // The types for this are wrong, it's actually a string[]
    return roleSet;
}
const rule = {
    meta: {
        type: "problem",
        docs: {
            url: (0, utils_1.makeDocsURL)("no-redundant-roles")
        },
        messages: {
            default: "The element {{type}} has an implicit role of {{role}}. Defining this explicitly is redundant and should be avoided."
        },
        schema: [
            {
                type: "object",
                additionalProperties: {
                    type: "array",
                    items: {
                        type: "string"
                    },
                    uniqueItems: true
                }
            }
        ]
    },
    create(context) {
        return (0, utils_1.defineTemplateBodyVisitor)(context, {
            VElement(node) {
                const type = (0, utils_1.getElementType)(node);
                const implicitRoleSet = getImplicitRoleSet(node);
                const explicitRole = (0, utils_1.getElementAttributeValue)(node, "role");
                if (!implicitRoleSet || !explicitRole) {
                    return;
                }
                const permittedRoles = context.options[0] || {};
                if ((permittedRoles[type] || [])
                    .concat(exceptions[type] || [])
                    .includes(explicitRole)) {
                    return;
                }
                if (implicitRoleSet.includes(explicitRole)) {
                    context.report({
                        node: node,
                        messageId: "default",
                        data: { type, role: explicitRole.toString() }
                    });
                }
            }
        });
    }
};
exports.default = rule;
