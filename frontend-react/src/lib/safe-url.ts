// Links typed in by users are only rendered as links when they're http(s) links, so a stored
// javascript: or data: link can't run anything when clicked. Links without a scheme
// (www.example.org) open as https. Same rules as frontend/src/methods/safe-url.js.
export function safeUrl(value: unknown): string | null {
    if (typeof value !== 'string') return null;

    const link = value.trim();
    if (!link) return null;

    try {
        const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(link) ? link : `https://${link}`);
        return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
    } catch {
        return null;
    }
}
