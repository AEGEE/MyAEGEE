// The logged-in member and their permissions, from the session the Vue app stores (see api.ts).
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { api, clearSession, hasSession, SERVICES } from './api';
import type { Member, Permission } from './types';

export interface Session {
    status: 'loading' | 'ready';
    user: Member | null;
    permissions: Permission[];
    // Problems that make the Vue app send the member to /profile/update first.
    validationErrors: Record<string, string>;
    can: (permissionSuffix: string) => boolean;
    logout: () => Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

// The checks of frontend/src/validate-user.js.
const RESTRICTED_EMAILS = ['aegee.org', 'aegee.eu'];
const ALLOWED_BODY_TYPES = ['antenna', 'contact antenna', 'contact', 'external', 'other'];

export const validateUser = (user: Member): Record<string, string> => {
    if (user.superadmin) return {};
    const errors: Record<string, string> = {};
    if (RESTRICTED_EMAILS.some((domain) => user.email.endsWith(domain))) errors.email = `Your email can not be in one of the following domains: ${RESTRICTED_EMAILS.join(', ')}.`;
    if (!user.bodies.some((body) => ALLOWED_BODY_TYPES.includes(body.type))) errors.bodies = 'You should be a member of at least 1 local.';
    if (!user.privacy_consent) errors.privacy = 'You should agree to the Privacy Policy.';
    if (!/^(?![0-9._-]*$)[a-zA-Z0-9._-]+$/.test(user.username)) errors.username = 'Your username cannot consist of numbers only.';
    return errors;
};

const fetchSession = async (): Promise<{ user: Member; permissions: Permission[] } | null> => {
    // Like the Vue app: no tokens, no request.
    if (!hasSession()) return null;
    try {
        const me = await api.get<Member>(`${SERVICES.core}/members/me`, { forAuth: true });
        const permissions = await api.get<Permission[]>(`${SERVICES.core}/my_permissions`);
        return { user: me.data, permissions: permissions.data };
    } catch {
        return null;
    }
};

export function SessionProvider({ children }: { children: ReactNode }) {
    const queryClient = useQueryClient();
    const query = useQuery({ queryKey: ['session'], queryFn: fetchSession, staleTime: Infinity, retry: false });

    const session = useMemo<Session>(() => {
        const user = query.data?.user ?? null;
        const permissions = query.data?.permissions ?? [];
        return {
            status: query.isPending ? 'loading' : 'ready',
            user,
            permissions,
            validationErrors: user ? validateUser(user) : {},
            can: (suffix) => permissions.some((permission) => permission.combined.endsWith(suffix)),
            logout: async () => {
                try {
                    await api.post(`${SERVICES.core}/logout`, { refresh_token: window.localStorage.getItem('refresh-token') });
                } catch {
                    // Logged out locally anyway.
                }
                clearSession();
                queryClient.setQueryData(['session'], null);
            }
        };
    }, [query.data, query.isPending, queryClient]);

    return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
    const session = useContext(SessionContext);
    if (!session) throw new Error('useSession() outside <SessionProvider>');
    return session;
}
