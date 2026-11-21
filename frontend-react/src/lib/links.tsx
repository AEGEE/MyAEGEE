// Links that work across the two apps: paths this app serves (the gateway's list,
// frontend/src/migrated-routes.json) navigate inside it; all others are plain links, which load
// the page from the Vue app.
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router';
import { migratedPatterns } from 'virtual:vue-app';

import { handOver } from './flash';

const patterns = migratedPatterns.map((pattern) => new RegExp(pattern));

export const isReactPath = (path: string): boolean => {
    const pathname = new URL(path, window.location.origin).pathname;
    return patterns.some((pattern) => pattern.test(pathname));
};

// Navigates to a path of either app; toasts shown just before survive the page load.
export const leaveTo = (path: string): void => {
    handOver();
    window.location.assign(path);
};

interface AppLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
    to: string;
    children: ReactNode;
}

export function AppLink({ to, children, ...props }: AppLinkProps) {
    if (isReactPath(to) && !props.target) {
        return <Link to={to} {...props}>{children}</Link>;
    }
    return <a href={to} {...props} onClick={(event) => { props.onClick?.(event); if (!props.target) handOver(); }}>{children}</a>;
}
