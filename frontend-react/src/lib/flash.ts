// Toasts that survive a full page load into the other app (the Vue app, for pages this app
// doesn't serve). Same key and format as frontend/src/methods/flash.js.
const KEY = 'myaegee:flash';
const HAND_OVER_MS = 2000;

export type ToastType = 'success' | 'info' | 'warning' | 'danger';

export interface FlashMessage {
    message: string;
    type: ToastType;
}

// The Vue app stores Buefy's types (is-success); this app uses the plain names.
const fromVue = (type: unknown): ToastType => {
    const name = String(type ?? '').replace(/^is-/, '');
    return (['success', 'info', 'warning', 'danger'] as const).find((t) => t === name) ?? 'info';
};

const recent: (FlashMessage & { at: number })[] = [];

export function remember(message: FlashMessage): void {
    recent.push({ ...message, at: Date.now() });
    if (recent.length > 10) recent.shift();
}

export function handOver(): void {
    const now = Date.now();
    const pending = recent
        .filter((message) => now - message.at < HAND_OVER_MS)
        .map(({ message, type }) => ({ message, type: `is-${type}` }));
    if (pending.length === 0) return;
    try {
        window.sessionStorage.setItem(KEY, JSON.stringify(pending));
    } catch {
        // Storage unavailable: the toast is lost, nothing worse.
    }
}

export function takeOver(): FlashMessage[] {
    try {
        const raw = window.sessionStorage.getItem(KEY);
        window.sessionStorage.removeItem(KEY);
        const pending: unknown = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(pending)) return [];
        return pending
            .filter((item): item is { message: string; type?: string } => typeof item?.message === 'string')
            .map((item) => ({ message: item.message, type: fromVue(item.type) }));
    } catch {
        return [];
    }
}
