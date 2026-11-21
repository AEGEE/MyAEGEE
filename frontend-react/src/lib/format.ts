// Dates the way the Vue app shows them (its `date` and `datetime` filters), in the browser's
// time zone: 2027-03-01 and 2027-03-01 10:00.
const pad = (value: number): string => String(value).padStart(2, '0');

export function formatDate(value: string | Date | null | undefined): string {
    if (!value) return '';
    const date = new Date(value);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatDateTime(value: string | Date | null | undefined): string {
    if (!value) return '';
    const date = new Date(value);
    return `${formatDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function isSameDay(a: string, b: string): boolean {
    return formatDate(a) === formatDate(b);
}

export function capitalize(value: unknown): string {
    if (typeof value !== 'string') return '';
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

// Booleans as Yes/No, everything else as is (the Vue `beautify` filter).
export function beautify(value: unknown): string {
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return value == null ? '' : String(value);
}
