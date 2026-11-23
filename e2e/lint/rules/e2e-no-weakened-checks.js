// Two checks run in every test without being asked for: a request nobody answered fails the
// test (`strictApi`), and so does console.error in a finished area unless the test expects that
// message (`allowedConsoleErrors`). A spec may not turn the first off, nor allow every message.
const { keyName } = require('../ast.js');

// A message the page can't have written by accident.
const PROBES = ['', '§'];

// What is left of a pattern when everything that isn't plain text is taken out.
const literalText = (pattern) => pattern
    .replace(/\\[dDwWsSbBnrtfv]/g, ' ')
    .replace(/\\(.)/g, '$1')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\{\d*,?\d*\}/g, ' ')
    .replace(/[.*+?^$()|]/g, ' ');

const problemWith = (element) => {
    if (!element || element.type !== 'Literal' || !element.regex) return 'notLiteral';
    let regex;
    try {
        regex = new RegExp(element.regex.pattern, element.regex.flags.replace(/[gy]/g, ''));
    } catch {
        return undefined;
    }
    if (PROBES.some((probe) => regex.test(probe))) return 'catchAll';
    return /[A-Za-z0-9]{3}/.test(literalText(element.regex.pattern)) ? undefined : 'noText';
};

module.exports = {
    meta: {
        type: 'problem',
        docs: { description: 'a spec keeps the strict API mock on and only allows console errors it names' },
        schema: [{
            type: 'object',
            properties: { allowStrictApiOff: { type: 'boolean' } },
            additionalProperties: false
        }],
        messages: {
            strictApi: 'A behavioural spec keeps `strictApi` on: a request nobody answered must fail the test. Answer the request, or use `api.fallback(mockEverything)` for a page of another area. Only the generated smoke and axe tests turn it off.',
            notLiteral: '`allowedConsoleErrors` is a list of regular expression literals, each with the text of the message the test expects: `allowedConsoleErrors: [/Network Error/]`.',
            catchAll: 'This pattern matches every console.error, which turns the check off. Name the message the test expects: `allowedConsoleErrors: [/Network Error/]`.',
            noText: 'This pattern has no text of the message it allows, so it allows nearly everything. Name the message the test expects: `allowedConsoleErrors: [/Network Error/]`.'
        }
    },
    create(context) {
        const { allowStrictApiOff = false } = context.options[0] || {};
        return {
            'ObjectExpression > Property': (node) => {
                const name = keyName(node);
                if (name === 'strictApi' && !allowStrictApiOff && !(node.value.type === 'Literal' && node.value.value === true)) {
                    context.report({ node, messageId: 'strictApi' });
                }
                if (name !== 'allowedConsoleErrors') return;
                if (node.value.type !== 'ArrayExpression') {
                    context.report({ node: node.value, messageId: 'notLiteral' });
                    return;
                }
                for (const element of node.value.elements) {
                    const messageId = problemWith(element);
                    if (messageId) context.report({ node: element || node.value, messageId });
                }
            }
        };
    }
};
