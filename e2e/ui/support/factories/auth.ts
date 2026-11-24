// Factories for what core answers on the pages of the area `auth`: logging in, renewing the
// session and signing up. See base.ts for the rules. Members and campaigns come from core.ts.
import { id } from './base.ts';

export const NOT_ENTITIES: string[] = [];

// `POST core /login` and `POST core /renew`: a new pair of tokens. core rotates the refresh
// token on every renewal, so both answers have both tokens.
export interface Tokens {
    success: true;
    access_token: string;
    refresh_token: string;
}

export const tokens = (overrides: Partial<Tokens> = {}): Tokens => {
    const tokenId = id();
    return {
        success: true,
        access_token: `access-token-${tokenId}`,
        refresh_token: `refresh-token-${tokenId}`,
        ...overrides
    };
};
