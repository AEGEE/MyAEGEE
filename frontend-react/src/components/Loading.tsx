// What's shown while a page waits for its data. The text is announced to screen readers.
export function Loading({ label = 'Loading…' }: { label?: string }) {
    return <p role="status" aria-live="polite">{label}</p>;
}
