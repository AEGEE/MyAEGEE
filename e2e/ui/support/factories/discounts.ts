// Factories for what the discounts service answers: categories of partner descriptions,
// integrations (the partners whose codes members claim) and codes. See base.ts for the rules.
import { id, iso } from './base.ts';

// One partner description of a category, as managers type it in. `icon` is a Font Awesome
// name without the `fa-` prefix; the page only shows icons registered in
// frontend/src/fontawesome.js ('bus', 'bed', 'utensils', ...).
export interface Discount {
    name: string;
    icon: string;
    shortDescription: string;
    longDescription: string;
}

export const discount = (overrides: Partial<Discount> = {}): Discount => ({
    name: 'Flixbus',
    icon: 'bus',
    shortDescription: '10% off every ride',
    longDescription: 'Book on **flixbus.com** with your code.',
    ...overrides
});

// A category of the discounts page (`GET discounts /categories`, `GET discounts /categories/:id`).
// Its discounts are a JSON column, not rows of their own.
export interface DiscountCategory {
    id: number;
    name: string;
    discounts: Discount[];
    created_at: string;
    updated_at: string;
}

export const discountCategory = (overrides: Partial<DiscountCategory> = {}): DiscountCategory => ({
    id: id(),
    name: 'Travel',
    discounts: [discount()],
    created_at: iso(-60),
    updated_at: iso(-30),
    ...overrides
});

export type QuotaPeriod = 'day' | 'month' | 'year';

// A partner whose codes members claim (`GET discounts /integrations`, `/integrations/:id`): a
// member may claim `quota_amount` codes per `quota_period`. `code` is a short name of the
// partner, unique among the integrations. The description is markdown.
export interface Integration {
    id: number;
    name: string;
    code: string;
    description: string | null;
    quota_period: QuotaPeriod;
    quota_amount: number;
    created_at: string;
    updated_at: string;
}

export const integration = (overrides: Partial<Integration> = {}): Integration => {
    const integrationId = overrides.id ?? id();
    return {
        id: integrationId,
        name: 'Flixbus',
        code: `flixbus-${integrationId}`,
        description: 'Use the code on **flixbus.com**.',
        quota_period: 'month',
        quota_amount: 1,
        created_at: iso(-60),
        updated_at: iso(-30),
        ...overrides
    };
};

// A code of an integration, as `POST discounts /integrations/:id/claim` answers it: the code
// the member got, claimed (`claimed_by`) at `updated_at`.
export interface DiscountCode {
    id: number;
    value: string;
    integration_id: number;
    claimed_by: number | null;
    created_at: string;
    updated_at: string;
}

export const discountCode = (overrides: Partial<DiscountCode> = {}): DiscountCode => {
    const codeId = overrides.id ?? id();
    return {
        id: codeId,
        value: `FLIX-${codeId}`,
        integration_id: 1,
        claimed_by: 2,
        created_at: iso(-10),
        updated_at: iso(-1),
        ...overrides
    };
};

// A code the member claimed, with its integration (`GET discounts /codes/mine`).
export interface MyDiscountCode extends DiscountCode {
    integration: Integration;
}

export const myDiscountCode = (overrides: Partial<MyDiscountCode> = {}): MyDiscountCode => {
    const partner = overrides.integration ?? integration(overrides.integration_id === undefined ? {} : { id: overrides.integration_id });
    return {
        ...discountCode({ integration_id: partner.id, ...overrides }),
        integration: partner
    };
};
