// Answers for the pages of the area `discounts` in the smoke and accessibility runs (see index.ts).
import type { ApiMock } from '../api-mock.ts';
import { ok } from '../factories/base.ts';
import { discount, discountCategory, integration, myDiscountCode } from '../factories/discounts.ts';

// A category with two discounts and two partners, one of whose codes the member claimed, so
// the pages show their cards, rows and forms filled in.
export const smoke = (api: ApiMock): void => {
    const travel = discountCategory({
        id: 1,
        name: 'Travel',
        discounts: [discount(), discount({ name: 'Hostelworld', icon: 'bed', shortDescription: 'No booking fee', longDescription: 'Valid for *every* hostel.' })]
    });
    const flixbus = integration({ id: 1 });
    const hostelworld = integration({ id: 2, name: 'Hostelworld', code: 'hostelworld', description: 'No booking fee.' });

    api.json('GET discounts /categories', ok([travel]));
    api.json('GET discounts /categories/:id', ok(travel));
    api.json('GET discounts /integrations', ok([flixbus, hostelworld]));
    api.json('GET discounts /integrations/:id', ok(flixbus));
    api.json('GET discounts /codes/mine', ok([myDiscountCode({ integration: flixbus })]));
};

// Route name -> values for the parameters of its path (the default is '1').
export const params: Record<string, Record<string, string>> = {};

// Routes that send the viewer on: where to, and the title of that page.
export const redirects: Record<string, { url: string; title: string }> = {};

// Error messages that are the expected result of the generic answers.
export const expectedAlerts: Record<string, RegExp> = {};
