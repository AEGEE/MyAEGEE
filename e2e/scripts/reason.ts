// Whether a written reason says something. Everything that takes frontend code out of the
// coverage numbers or loosens the gate needs one: istanbul ignore comments (check-ignores.ts),
// template exceptions and accepted downgrades (coverage-gate.ts, coverage.ts).
//
// A length and a list of placeholders can't tell a good reason from a bad one. They only stop
// the entries that were never meant to be read: a reviewer still has to read the rest.
export const MIN_REASON_WORDS = 4;
export const MIN_REASON_LENGTH = 20;

const PLACEHOLDER_WORDS = /^(todo|tbd|tba|fixme|x{3,}|wip|temp|tmp|lorem|asdf|n\/a)$/;

// "Hard to test" is why somebody wants an exception, not why no test can reach the code.
const NO_REASONS = [
    /\b(?:too |very |really )?(?:hard|difficult|tricky|annoying|painful|tedious) to (?:test|cover|reach|mock|trigger)\b/,
    /\b(?:see|same as|as) (?:above|below)\b/,
    /\bno (?:reason|time)\b/,
    /\b(?:will|to) (?:be )?(?:fix|fixed|do|done|add|added|test|tested) later\b/
];

const squash = (text: string): string => text.replace(/\s+/g, ' ').trim();

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// What is wrong with a reason, or undefined when it can stay. `not` lists texts the reason
// must add something to: for a template exception, its condition and file.
export const reasonProblem = (reason: string, { not = [] as string[] } = {}): string | undefined => {
    const text = squash(reason);
    const own = squash(not.map(squash).filter((given) => given !== '')
        .reduce((rest, given) => rest.replace(new RegExp(escape(given), 'gi'), ' '), text));
    const words = own.toLowerCase().split(/[^\p{L}\p{N}'/]+/u).filter((word) => /[\p{L}\p{N}]/u.test(word));

    const placeholder = words.find((word) => PLACEHOLDER_WORDS.test(word));
    if (placeholder) return `is a placeholder ("${placeholder}")`;
    const phrase = NO_REASONS.map((pattern) => text.toLowerCase().match(pattern)?.[0]).find((found) => found);
    if (phrase) return `is not a reason ("${phrase}")`;
    if (/([^\s\d])\1{3,}/u.test(text)) return 'repeats one character';
    if (words.length < MIN_REASON_WORDS || own.length < MIN_REASON_LENGTH) {
        return `needs at least ${MIN_REASON_WORDS} words and ${MIN_REASON_LENGTH} characters${not.length > 0 && own !== text ? ' of its own' : ''}`;
    }
    if (new Set(words).size < MIN_REASON_WORDS) return `needs at least ${MIN_REASON_WORDS} different words`;
    return undefined;
};
