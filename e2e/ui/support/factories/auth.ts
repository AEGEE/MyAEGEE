// Factories for what core answers on the pages of the area `auth`: logging in, renewing the
// session and signing up. See base.ts for the rules. Members and campaigns come from core.ts.
import { id, iso } from './base.ts';

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

// `POST core /signup/:campaign`: the account that was just made, not confirmed yet. The page
// only looks at the success of the answer.
export interface SignedUpMember {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    date_of_birth: string | null;
    gender: string | null;
    phone: string | null;
    address: string | null;
    about_me: string | null;
    privacy_consent: string;
    campaign_id: number;
    created_at: string;
    updated_at: string;
}

export const signedUpMember = (overrides: Partial<SignedUpMember> = {}): SignedUpMember => {
    const memberId = overrides.id ?? id();
    return {
        id: memberId,
        username: `new-member-${memberId}`,
        email: `new-member-${memberId}@example.com`,
        first_name: 'Nora',
        last_name: 'Newcomer',
        date_of_birth: '1999-05-01',
        gender: 'Female',
        phone: '+32 2 123 45 67',
        address: 'Somewhere in Europe',
        about_me: 'Just joined',
        privacy_consent: iso(0),
        campaign_id: 1,
        created_at: iso(0),
        updated_at: iso(0),
        ...overrides
    };
};
