// Factories for what core answers about signup campaigns and join requests
// (views/core/campaigns/, bodies/CampaignsList.vue, bodies/ViewJoinRequests.vue). See base.ts for
// the rules. What the signup page and everyone without `global:create:campaign` get of a
// campaign is `publicCampaign()` in core.ts.
import { iso, id } from './base.ts';
import { body, type Body, type PublicCampaign } from './core.ts';
import { memberListItem, type MemberListItem } from './core-members.ts';

// A campaign as the lists have it (`GET core /campaigns`, `GET core /bodies/:id/campaigns`) and as
// creating one answers: its own fields, without the body people join through it.
export interface Campaign {
    id: number;
    name: string;
    // The last part of the signup link: /signup/<url>.
    url: string;
    active: boolean;
    description_short: string | null;
    description_long: string;
    activate_user: boolean;
    // The body those who sign up through the campaign become members of.
    autojoin_body_id: number | null;
    created_at: string;
    updated_at: string;
}

export const campaign = (overrides: Partial<Campaign> = {}): Campaign => {
    const campaignId = overrides.id ?? id();
    return {
        id: campaignId,
        name: `Recruitment campaign ${campaignId}`,
        url: `campaign-${campaignId}`,
        active: true,
        description_short: null,
        description_long: 'Sign up and **join** our antenna.',
        activate_user: true,
        autojoin_body_id: 1,
        created_at: iso(-60),
        updated_at: iso(-5),
        ...overrides
    };
};

// One campaign as `GET core /campaigns/:id` answers holders of `global:create:campaign`: all of
// its fields, and of the body people join through it what everybody may see.
export interface CampaignDetail extends Campaign {
    autojoin_body: PublicCampaign['autojoin_body'];
}

// What everybody may see of the body a campaign adds new members to.
const publicBody = (bodyId: number | null): PublicCampaign['autojoin_body'] => (bodyId === null
    ? null
    : { id: bodyId, name: 'AEGEE-Antenna', email: `antenna-${bodyId}@example.com`, phone: null, address: 'Somewhere in Europe', website: null });

export const campaignDetail = (overrides: Partial<CampaignDetail> = {}): CampaignDetail => {
    const { autojoin_body: autojoinBody, ...own } = overrides;
    const base = campaign(own);
    return {
        ...base,
        autojoin_body: autojoinBody === undefined ? publicBody(base.autojoin_body_id) : autojoinBody
    };
};

// One campaign of a body as `GET core /bodies/:id/campaigns/:campaign_id` answers it: all of its
// fields and the whole body.
export interface BodyCampaign extends Campaign {
    autojoin_body_id: number;
    autojoin_body: Body;
}

export const bodyCampaign = (overrides: Partial<BodyCampaign> = {}): BodyCampaign => {
    const { autojoin_body: autojoinBody, ...own } = overrides;
    const joined = autojoinBody ?? body({ id: own.autojoin_body_id ?? 1, name: 'AEGEE-Antenna' });
    return {
        ...campaign(own),
        autojoin_body_id: joined.id,
        autojoin_body: joined
    };
};

// A request to join a body, as `GET core /bodies/:id/join-requests` lists it: with the member who
// asked. A rejected request is deleted, so the status is pending or approved.
export interface JoinRequest {
    id: number;
    user_id: number;
    body_id: number;
    motivation: string | null;
    status: 'pending' | 'approved';
    user: MemberListItem;
    created_at: string;
    updated_at: string;
}

export const joinRequest = (overrides: Partial<JoinRequest> = {}): JoinRequest => {
    const user = overrides.user ?? memberListItem({
        ...(overrides.user_id === undefined ? {} : { id: overrides.user_id }),
        first_name: 'Jane',
        last_name: 'Doe',
        primary_body_id: null
    });
    return {
        id: id(),
        body_id: 1,
        motivation: 'I want to join',
        status: 'pending',
        created_at: iso(-3),
        updated_at: iso(-3),
        ...overrides,
        user,
        user_id: user.id
    };
};
