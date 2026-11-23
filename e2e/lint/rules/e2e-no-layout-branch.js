// Every spec runs on a desktop and on a phone with the same steps. A spec that looks at the
// viewport, the layout or the project to decide what to do or to check is two tests in one, and
// usually half of it checks nothing. What differs between the viewports lives in the helpers
// of ui/support/shell.ts, which take `layout` as an argument.
const { keyName, propertyName, WRAPPERS } = require('../ast.js');

// Fixtures and options that say which project or viewport the test runs on.
const NAMES = new Set(['layout', 'frontend', 'isMobile', 'viewport', 'hasTouch']);
// The same as properties: testInfo.project, test.info().project, page.viewportSize(), metadata.layout.
const PROPERTIES = new Set(['project', 'viewportSize', 'layout', 'frontend', 'isMobile', 'viewport', 'hasTouch']);

const COMPARISONS = new Set(['==', '===', '!=', '!==', '<', '<=', '>', '>=']);
// Methods that compare: ['phone'].includes(layout), /mobile/.test(testInfo.project.name),
// testInfo.project.name.endsWith('mobile').
const COMPARING = new Set(['includes', 'indexOf', 'has', 'startsWith', 'endsWith', 'match', 'matchAll', 'search', 'test', 'localeCompare']);

// Whether `child` is the part of `parent` that decides something.
const decides = (parent, child) => {
    switch (parent.type) {
    case 'IfStatement':
    case 'ConditionalExpression':
    case 'WhileStatement':
    case 'DoWhileStatement':
    case 'ForStatement':
    case 'SwitchCase':
        return child === parent.test;
    case 'SwitchStatement':
        return child === parent.discriminant;
    case 'LogicalExpression':
        return child === parent.left;
    case 'BinaryExpression':
        return COMPARISONS.has(parent.operator);
    case 'UnaryExpression':
        return parent.operator === '!';
    case 'MemberExpression':
        // { desktop: a, phone: b }[layout]
        return parent.computed && child === parent.property;
    default:
        return false;
    }
};

const isStatement = (node) => /Statement$|Declaration$/.test(node.type);

module.exports = {
    meta: {
        type: 'problem',
        docs: { description: 'no branch on the viewport, layout or project in a spec' },
        schema: [],
        messages: {
            branch: 'A spec doesn\'t branch on `{{name}}`: it runs the same steps on a desktop and on a phone. Pass `layout` to a helper of ui/support/shell.ts (or add one there); for behaviour that exists on one viewport only, write a @phone-only test or a @desktop-only test with a reason.',
            alias: 'Don\'t copy `{{name}}` into another variable: pass it to the helper of ui/support/shell.ts that needs it.'
        }
    },
    create(context) {
        const check = (node, name) => {
            // What is read from it: `layout`, `viewport!.width`, `page.viewportSize()`,
            // `testInfo.project.name.endsWith('mobile')`.
            let read = node;
            let compares = false;
            for (;;) {
                const { parent } = read;
                if (parent.type === 'MemberExpression' && parent.object === read) read = parent;
                else if (parent.type === 'CallExpression' && parent.callee === read) {
                    compares ||= COMPARING.has(propertyName(read));
                    read = parent;
                } else if (WRAPPERS.has(parent.type)) read = parent;
                else break;
            }
            const holder = read.parent;
            // A comparison, wherever its answer goes: kept in a variable, or handed on.
            if (compares || (holder.type === 'CallExpression' && holder.arguments.includes(read) && COMPARING.has(propertyName(holder.callee)))) {
                context.report({ node, messageId: 'branch', data: { name } });
                return;
            }
            // const l = layout, const size = page.viewportSize(), name = testInfo.project.name:
            // a way around the checks below.
            if ((holder.type === 'VariableDeclarator' && holder.init === read) || (holder.type === 'AssignmentExpression' && holder.right === read)) {
                context.report({ node, messageId: 'alias', data: { name } });
                return;
            }
            let child = node;
            for (let parent = node.parent; parent; child = parent, parent = parent.parent) {
                if (decides(parent, child)) {
                    context.report({ node, messageId: 'branch', data: { name } });
                    return;
                }
                // The test, the condition of an `if` and the like are parts of statements and
                // are looked at above; anything further up is another statement's business.
                if (isStatement(parent)) return;
            }
        };

        return {
            // async ({ layout: l }) => …, const { project } = testInfo: the same under another name.
            'ObjectPattern > Property': (node) => {
                const name = keyName(node);
                const value = node.value.type === 'AssignmentPattern' ? node.value.left : node.value;
                const renamed = value.type !== 'Identifier' || value.name !== name;
                if ((NAMES.has(name) && renamed) || (PROPERTIES.has(name) && !NAMES.has(name))) context.report({ node, messageId: 'alias', data: { name } });
            },
            Identifier(node) {
                if (!NAMES.has(node.name)) return;
                const { parent } = node;
                // Not a use of the variable: a key, a property name, a parameter, a type, an import.
                if (parent.type === 'Property' && (parent.parent.type === 'ObjectPattern' || (parent.key === node && !parent.computed && !parent.shorthand))) return;
                if (parent.type === 'Property' && parent.shorthand && parent.key === node) return;
                if (parent.type === 'MemberExpression' && parent.property === node && !parent.computed) return;
                // `layout as string` and `layout!` are uses; every other TypeScript node is a type.
                if (/^Import|^Export/.test(parent.type) || (/^TS/.test(parent.type) && !/Expression$/.test(parent.type))) return;
                if (/Function/.test(parent.type) && parent.params.includes(node)) return;
                if (parent.type === 'VariableDeclarator' && parent.id === node) return;
                check(node, node.name);
            },
            MemberExpression(node) {
                if (!PROPERTIES.has(propertyName(node))) return;
                // testInfo.project.metadata.layout is one read, reported for `testInfo.project`.
                for (let inner = node.object; inner && ['MemberExpression', 'CallExpression'].includes(inner.type); inner = inner.object ?? inner.callee) {
                    if (PROPERTIES.has(propertyName(inner))) return;
                }
                check(node, context.sourceCode.getText(node));
            }
        };
    }
};
