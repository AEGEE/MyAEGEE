// Discounts data that real-stack tests create for themselves through the discounts API, as
// admin (who holds global:manage:discounts in core's seed).
//
// An integration that has codes can't be deleted (the service answers 409: codes can't be
// deleted, and members keep seeing their claimed codes with it), so integrations stay in the
// test databases. Their names and codes are unique, so tests don't see each other's.
import { expect } from '@playwright/test';

import type { Api, Envelope } from './api.ts';

export interface RealIntegration {
    id: number;
    name: string;
    code: string;
    description: string | null;
    quota_period: string;
    quota_amount: number;
}

export interface RealCategory {
    id: number;
    name: string;
    discounts: { name: string; icon: string; shortDescription: string; longDescription: string }[];
}

const unique = (): string => `${Date.now()}-${Math.round(Math.random() * 1e6)}`;

// A new integration, by default one code per month.
export async function createIntegration(api: Api, overrides: Partial<RealIntegration> = {}): Promise<RealIntegration> {
    const suffix = unique();
    const res = await api.call<Envelope<RealIntegration>>('admin', 'POST', '/api/discounts/integrations', {
        name: `E2E partner ${suffix}`,
        code: `e2e-${suffix}`,
        description: 'Use the code on **example.org**.',
        quota_period: 'month',
        quota_amount: 1,
        ...overrides
    });
    expect(res.status, `create integration: ${JSON.stringify(res.body)}`).toBe(200);
    return res.body.data;
}

// Adds codes to an integration and returns them.
export async function addCodes(api: Api, integration: RealIntegration, count = 2): Promise<string[]> {
    const codes = Array.from({ length: count }, (_, index) => `E2E-${integration.id}-${index}-${unique()}`);
    const res = await api.call('admin', 'POST', `/api/discounts/integrations/${integration.id}/codes`, codes);
    expect(res.status, `add codes: ${JSON.stringify(res.body)}`).toBe(200);
    return codes;
}

// A new category with one discount, and its cleanup.
export async function createCategory(api: Api): Promise<[RealCategory, () => Promise<void>]> {
    const res = await api.call<Envelope<RealCategory>>('admin', 'POST', '/api/discounts/categories', {
        name: `E2E category ${unique()}`,
        discounts: [{ name: 'E2E partner', icon: 'bus', shortDescription: '10% off', longDescription: 'Book on **example.org**.' }]
    });
    expect(res.status, `create category: ${JSON.stringify(res.body)}`).toBe(200);
    const category = res.body.data;
    return [category, async () => {
        const deleted = await api.call('admin', 'DELETE', `/api/discounts/categories/${category.id}`);
        expect(deleted.status, `delete category: ${JSON.stringify(deleted.body)}`).toBe(200);
    }];
}
