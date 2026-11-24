// Helpers for the specs of the area `auth` and of the shell's session handling: what core
// answers to a visitor who logs in.
import type { ApiMock } from './api-mock.ts';
import { ok } from './factories/base.ts';
import { tokens as makeTokens, type Tokens } from './factories/auth.ts';
import { member as makeMember, seedPermissions, type Member, type Permission } from './factories/core.ts';

// What core answers for a session whose access token is unknown or expired.
export const UNAUTHORIZED = { success: false, message: 'You are not authorized.' };

export interface LoginAnswers {
    tokens: Tokens;
    member: Member;
}

// A visitor (session 'anonymous') who logs in: `POST core /login` answers with new tokens, and
// from then on core knows the member and their permissions, for requests that carry the new
// access token only. Returns what it answers, to compare with what the page stored.
export const answerLogin = (
    api: ApiMock,
    { member = makeMember({ id: 2, username: 'member', first_name: 'Alex', last_name: 'Member' }), permissions = seedPermissions('membersCircle'), tokens = makeTokens() }:
        { member?: Member; permissions?: Permission[]; tokens?: Tokens } = {}
): LoginAnswers => {
    const known = (headers: Record<string, string>): boolean => headers['x-auth-token'] === tokens.access_token;
    api.json('POST core /login', tokens);
    api.on('GET core /members/me', ({ headers }) => (known(headers) ? { json: ok(member) } : { status: 401, json: UNAUTHORIZED }));
    api.on('GET core /my_permissions', ({ headers }) => (known(headers) ? { json: ok(permissions) } : { status: 401, json: UNAUTHORIZED }));
    return { tokens, member };
};

// The tokens the app keeps in localStorage.
export const storedTokens = (): [string | null, string | null] => [localStorage.getItem('access-token'), localStorage.getItem('refresh-token')];
