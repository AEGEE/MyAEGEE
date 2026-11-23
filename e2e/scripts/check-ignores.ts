// Checks the comments that keep frontend code out of the coverage numbers.
//
// The only accepted form, in the <script> of a .vue file or in a .js file of frontend/src, is
//   /* istanbul ignore next -- <reason> */      (also `if` and `else`)
// with a reason of at least three words. Whole-file ignores and the c8/v8 forms are refused.
// A template can't take such a comment: its exceptions are listed in the area's file in
// ui/support/coverage/.
//
// Usage: node scripts/check-ignores.ts   (part of `npm run lint`)
// Prints every ignore comment with its place, and fails when one of them breaks the rules.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const SRC = path.join(root, 'frontend/src');
const MIN_REASON_WORDS = 3;

export interface IgnoreComment {
    // Path from the repository root.
    file: string;
    line: number;
    // The comment as written, on one line.
    text: string;
    // What is wrong with it, if anything.
    error?: string;
}

const MENTION = /\b(istanbul|c8|v8)\s+ignore\b/g;
// From the mention on: what is ignored, the reason, the end of the block comment.
const ALLOWED = /^istanbul\s+ignore\s+(next|if|else)\s+--\s+([\s\S]*?)\s*\*\//;

const sourceFiles = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) return sourceFiles(file);
        return /\.(js|vue)$/.test(entry.name) ? [file] : [];
    })
    .sort();

const check = (source: string, index: number, isVue: boolean): { text: string; error?: string } => {
    const lineEnd = source.indexOf('\n', index);
    const rest = source.slice(index);
    const before = source.slice(0, index);
    const firstLine = source.slice(before.lastIndexOf('\n') + 1, lineEnd === -1 ? undefined : lineEnd).trim();

    const tool = rest.match(/^\w+/)![0];
    if (tool !== 'istanbul') return { text: firstLine, error: `\`${tool} ignore\` is not used here, write \`/* istanbul ignore next -- <reason> */\`` };
    if (/^istanbul\s+ignore\s+file\b/.test(rest)) return { text: firstLine, error: 'a whole file can\'t be ignored, mark the code that can\'t be tested' };

    if (isVue) {
        const script = { start: source.indexOf('<script'), end: source.lastIndexOf('</script>') };
        if (script.start === -1 || index < script.start || index > script.end) {
            return { text: firstLine, error: 'only works in <script>; for a template, add a `templateExceptions` entry to the area\'s file in e2e/ui/support/coverage/' };
        }
    }

    if (!/\/\*\s*$/.test(before)) return { text: firstLine, error: 'has to be a block comment that starts with it: `/* istanbul ignore next -- <reason> */`' };

    if (!/^istanbul\s+ignore\s+(next|if|else)\b/.test(rest)) return { text: firstLine, error: 'has to say `next`, `if` or `else`' };
    const allowed = rest.match(ALLOWED);
    if (!allowed) return { text: firstLine, error: 'needs a reason: `/* istanbul ignore next -- <reason> */`' };

    const text = `/* ${allowed[0].replace(/\s+/g, ' ')}`;
    const words = allowed[2].split(/\s+/).filter((word) => /\w/.test(word));
    if (words.length < MIN_REASON_WORDS) return { text, error: `the reason needs at least ${MIN_REASON_WORDS} words` };
    return { text };
};

// Every ignore comment in frontend/src, valid or not.
export const findIgnoreComments = (): IgnoreComment[] => sourceFiles(SRC).flatMap((file) => {
    const source = fs.readFileSync(file, 'utf8');
    return [...source.matchAll(MENTION)].map((match) => ({
        file: path.relative(root, file),
        line: source.slice(0, match.index).split('\n').length,
        ...check(source, match.index, file.endsWith('.vue'))
    }));
});

if (import.meta.main) {
    const comments = findIgnoreComments();
    for (const comment of comments) {
        console.log(`${comment.file}:${comment.line}  ${comment.text}`);
        if (comment.error) console.log(`  error: ${comment.error}`);
    }

    const errors = comments.filter((comment) => comment.error).length;
    console.log(`${comments.length} coverage ignore comment(s) in frontend/src, ${errors} not allowed.`);
    if (errors > 0) process.exit(1);
}
