// Toasts: short messages after an action ("Event is deleted."). Errors and warnings are
// announced right away (role="alert"), the rest politely (role="status"). Each stays until it
// times out or is dismissed, and hovering or focusing it pauses the timer (WCAG 2.2.1).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { remember, takeOver, type ToastType } from './flash';
import styles from '../styles/toast.module.css';

interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

interface ToastApi {
    show: (message: string, type?: ToastType) => void;
    success: (message: string) => void;
    info: (message: string) => void;
    warning: (message: string) => void;
    error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
const DURATION_MS = 5000;

let nextId = 1;

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
    const [paused, setPaused] = useState(false);
    useEffect(() => {
        if (paused) return undefined;
        const timer = window.setTimeout(() => onDismiss(toast.id), DURATION_MS);
        return () => window.clearTimeout(timer);
    }, [paused, toast.id, onDismiss]);

    const urgent = toast.type === 'danger' || toast.type === 'warning';
    return (
        // Hovering only pauses the timer; focus does the same for keyboard users.
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions
        <div
            role={urgent ? 'alert' : 'status'}
            className={`${styles.toast} ${styles[toast.type]}`}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
        >
            <span>{toast.message}</span>
            <button type="button" className={styles.close} aria-label="Dismiss" onClick={() => onDismiss(toast.id)}>×</button>
        </div>
    );
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const dismiss = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);
    const show = useCallback((message: string, type: ToastType = 'success') => {
        remember({ message, type });
        setToasts((current) => [...current, { id: nextId++, message, type }]);
    }, []);

    // Toasts handed over by the page before the last full page load (see flash.ts).
    const tookOver = useRef(false);
    useEffect(() => {
        if (tookOver.current) return;
        tookOver.current = true;
        takeOver().forEach(({ message, type }) => show(message, type));
    }, [show]);

    const toastApi = useMemo<ToastApi>(() => ({
        show,
        success: (message) => show(message, 'success'),
        info: (message) => show(message, 'info'),
        warning: (message) => show(message, 'warning'),
        error: (message) => show(message, 'danger')
    }), [show]);

    return (
        <ToastContext.Provider value={toastApi}>
            {children}
            <section className={styles.region} aria-label="Notifications">
                {toasts.map((toast) => <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />)}
            </section>
        </ToastContext.Provider>
    );
}

export function useToast(): ToastApi {
    const toastApi = useContext(ToastContext);
    if (!toastApi) throw new Error('useToast() outside <ToastProvider>');
    return toastApi;
}
