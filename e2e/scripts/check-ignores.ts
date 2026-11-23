// Checks the comments that keep frontend code out of the coverage numbers.
//
// The only accepted form, in the <script> of a .vue file or in a .js file of frontend/src, is
//   /* istanbul ignore next -- <reason> */      (also `if` and `else`)
// with a reason that says something (scripts/reason.ts: at least four words and 20 characters,
// no placeholder). Whole-file ignores and the c8/v8 forms are refused.
// A template can't take such a comment: its exceptions are listed in the area's file in
// ui/support/coverage/.
//
// Usage: node scripts/check-ignores.ts   (part of `npm run lint`)
// Prints every ignore comment with its place, and fails when one of them breaks the rules.
import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import { reasonProblem } from './reason.ts';

const root = path.resolve(import.meta.dirname, '../..');
const SRC = path.join(root, 'frontend/src');

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

const lineSpan = (file: ts.SourceFile, start: number, end: number): number => file.getLineAndCharacterOfPosition(end).line - file.getLineAndCharacterOfPosition(start).line + 1;

// The code an ignore comment that ends at `commentEnd` takes out of the numbers: the first
// statement, function or expression that starts after it, as a whole (which is what istanbul
// attaches the comment to), or the one side of the `if` or `?:` there that `if` and `else` name.
const ignoredLinesAt = (file: ts.SourceFile, commentEnd: number, what: string): number => {
    let covered: ts.Node | undefined;
    const visit = (node: ts.Node): void => {
        if (node.end <= commentEnd) return;
        const start = node.getStart(file);
        // The outermost node that starts first after the comment.
        if (node.kind !== ts.SyntaxKind.SourceFile && start >= commentEnd && (!covered || start < covered.getStart(file))) covered = node;
        if (start < commentEnd || node.kind === ts.SyntaxKind.SourceFile) ts.forEachChild(node, visit);
    };
    visit(file);
    if (!covered) return 1;

    let side: ts.Node | undefined = covered;
    if (what !== 'next' && ts.isIfStatement(covered)) side = what === 'if' ? covered.thenStatement : covered.elseStatement;
    if (what !== 'next' && ts.isConditionalExpression(covered)) side = what === 'if' ? covered.whenTrue : covered.whenFalse;
    // An `else` that isn't written is one line that never runs.
    return side ? lineSpan(file, side.getStart(file), side.end) : 1;
};

// The ignore comments of a source and how many lines of code they take out of the numbers
// together, valid or not. The gate compares both per file with the same file at its base
// (scripts/coverage-gate.ts): a comment that is swapped for one that covers more must not pass
// because their number stayed the same.
export const ignoredCode = (source: string, isVue: boolean): { comments: number; lines: number } => {
    const mentions = [...source.matchAll(MENTION)];
    if (mentions.length === 0) return { comments: 0, lines: 0 };

    // The <script> of a .vue file, at its own offsets: only spans of lines are asked for.
    const script = isVue ? { start: source.indexOf('>', source.indexOf('<script')) + 1, end: source.lastIndexOf('</script>') } : { start: 0, end: source.length };
    const hasScript = !isVue || (source.indexOf('<script') !== -1 && script.end !== -1);
    const file = ts.createSourceFile('source.js', hasScript ? source.slice(script.start, script.end) : '', ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

    let lines = 0;
    for (const mention of mentions) {
        const close = source.indexOf('*/', mention.index);
        const inScript = hasScript && mention.index >= script.start && mention.index < script.end;
        // A comment outside the script, or one that never ends, is refused by the check below;
        // it counts as one line here.
        if (!inScript || close === -1 || close >= script.end) lines += 1;
        else lines += ignoredLinesAt(file, close + 2 - script.start, source.slice(mention.index).match(/^\w+\s+ignore\s+(\w+)/)?.[1] ?? 'next');
    }
    return { comments: mentions.length, lines };
};
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
    const problem = reasonProblem(allowed[2]);
    if (problem) return { text, error: `the reason ${problem}` };
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
