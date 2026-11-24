// A Summer University's way from a new season to an application, against the real services:
// SUCT creates a season on the Seasons pages, approves an SU of that season on the status page
// (both submissions), publishes it in full and opens its applications in the application period
// dialog; a member applies with visa details, and the applicant, the organisers and the board of
// the applicant's body (looked up in core) get their mails.
// The SU itself is created through the API: the SU editor is covered by the mocked-API suite in
// ui/summeruniversity/, like the details of every page here. The season stays inactive (seasons
// can't be deleted, and the active one is what every other test's SU list shows): SUCT may give
// an SU any season, and applying doesn't depend on the active season.
import type { Envelope, Mail, Member } from '../support/api.ts';
import { test, expect, loginInBrowser } from '../support/api.ts';
import { asSu, createSuEvent, freshYear, type SuApplication, type SuEvent, type SuSeason } from '../support/summeruniversity-data.ts';

const DAY = 24 * 60 * 60 * 1000;
const TIMEZONE = 'Europe/Brussels';

// The browser runs in Brussels, so the dates in the forms are Brussels time.
test.use({ timezoneId: TIMEZONE });

// A whole minute `days` from now, as the forms can only hold minutes.
const minuteFromNow = (days: number): Date => new Date(Math.floor((Date.now() + days * DAY) / 60000) * 60000);

// A date as a datetime-local input holds it in Brussels: 2027-03-01T10:00.
const local = (date: Date): string => date.toLocaleString('sv-SE', { timeZone: TIMEZONE }).slice(0, 16).replace(' ', 'T');

const recipients = (mail: Mail): string[] => [mail.to ?? []].flat().sort();

interface SuStored extends SuEvent {
    application_starts: string;
    application_ends: string;
    application_status: string;
}

type StoredApplication = SuApplication & Record<string, unknown>;

interface BodyMembership {
    user: Member & { notification_email: string };
}

const VISA = {
    'Passport number': 'X0000000',
    'Passport issue date': '2025-01-01',
    'Passport expiration date': '2035-01-01',
    'Passport issue authority': 'Test authority',
    'Place of birth': 'Testville',
    Embassy: 'Test embassy',
    'Street and house number': 'Example street 1',
    'Postal code': '0000',
    City: 'Testville',
    Country: 'Testland'
};

test.describe('a Summer University from its season to an application', () => {
    test('SUCT creates a season and approves, publishes and opens an SU of it; a member applies and everybody gets their mail', async ({ api, page }) => {
        // SUCT creates the season on the Seasons pages.
        const year = await freshYear(api);
        const seasonName = `E2E lifecycle season ${year}`;
        const deadline = minuteFromNow(-30);
        const periodStarts = minuteFromNow(-1);
        const periodEnds = minuteFromNow(30);

        await loginInBrowser(page, api, 'suct');
        await page.goto('/summeruniversity/seasons');
        await page.getByRole('link', { name: 'Create season' }).click();
        await expect(page).toHaveURL('/summeruniversity/seasons/new');
        await page.getByLabel('Year').fill(String(year));
        await page.getByLabel('Name').fill(seasonName);
        await page.getByLabel('Event submission deadline').fill(local(deadline));
        await page.getByLabel('Application period starts').fill(local(periodStarts));
        await page.getByLabel('Application period ends').fill(local(periodEnds));
        await page.getByRole('button', { name: 'Save season' }).click();

        await expect(page.getByRole('alert').or(page.getByRole('status')).filter({ hasText: 'Season is saved.' })).toBeVisible();
        await expect(page).toHaveURL('/summeruniversity/seasons');
        const seasonRow = page.getByRole('row').filter({ hasText: seasonName });
        await expect(seasonRow).toContainText(String(year));
        await expect(seasonRow.getByRole('button', { name: 'Set active' })).toBeVisible();

        const seasons = await asSu<(SuSeason & Record<string, unknown>)[]>(api, 'suct', 'GET', '/seasons');
        expect(seasons.find((season) => season.year === year)).toMatchObject({
            name: seasonName,
            active: false,
            event_submission_deadline: deadline.toISOString(),
            application_period_starts: periodStarts.toISOString(),
            application_period_ends: periodEnds.toISOString()
        });

        // An SU of that season, waiting for its first approval. `board` is left out of the
        // organisers, so the board's mail can only come from core's lookup of the body's board.
        const event = await createSuEvent(api, { season: year, organizers: ['admin', 'netcom', 'nd'] });
        expect(event).toMatchObject({ season: year, status: 'first submission', published: 'none' });

        // SUCT takes it through both approvals, publishes it in full and opens the applications.
        await page.goto('/summeruniversity/change_status');
        const row = page.getByRole('row').filter({ has: page.getByRole('link', { name: event.name }) });
        const steps: [string, string][] = [
            ['Approve first submission', 'Event status is now "first approval".'],
            ['Submit second draft', 'Event status is now "second submission".'],
            ['Approve second submission', 'Event status is now "second approval".'],
            ['Publish minimal event', 'Event publication is now "minimal".'],
            ['Publish full event', 'Event publication is now "full".']
        ];
        for (const [button, message] of steps) {
            await row.getByRole('button', { name: button }).click();
            await expect(page.getByRole('alert').or(page.getByRole('status')).filter({ hasText: message })).toBeVisible();
        }
        await expect(row.getByRole('button', { name: 'Unpublish event' })).toBeVisible();
        await expect(row.getByRole('button', { name: /^(Approve|Reject|Submit|Publish)/ })).toHaveCount(0);

        const applicationStarts = minuteFromNow(-1);
        const applicationEnds = minuteFromNow(10);
        await row.getByRole('button', { name: 'Change application period' }).click();
        const dialog = page.getByRole('dialog', { name: 'Set application period' });
        await dialog.getByLabel('Application starts').fill(local(applicationStarts));
        await dialog.getByLabel('Application ends').fill(local(applicationEnds));
        await dialog.getByRole('button', { name: 'Save' }).click();
        await expect(page.getByRole('alert').or(page.getByRole('status')).filter({ hasText: 'Event application period was updated.' })).toBeVisible();
        await expect(dialog).toBeHidden();
        await expect(row).toContainText('Open');

        const stored = await asSu<SuStored>(api, 'suct', 'GET', `/single/${event.id}`);
        expect(stored).toMatchObject({
            status: 'second approval',
            published: 'full',
            application_status: 'open',
            application_starts: applicationStarts.toISOString(),
            application_ends: applicationEnds.toISOString()
        });

        // The member applies, with visa details.
        const applicant = await api.me('member');
        await loginInBrowser(page, api, 'member');
        await page.goto(`/summeruniversity/${event.url}/applications/me`);
        await expect(page.getByRole('heading', { name: `Apply to ${event.name}` })).toBeVisible();
        await expect(page.getByRole('combobox', { name: /^Body/ })).toHaveValue(String(applicant.bodies[0].id));
        await page.getByRole('combobox', { name: /^Nationality/ }).selectOption('Belgian');
        await page.getByRole('combobox', { name: /^Travelling from/ }).selectOption('Belgium');
        await page.getByRole('combobox', { name: /^Meals type/ }).selectOption('Vegan');
        await page.getByRole('checkbox', { name: 'Visa required?' }).check();
        for (const [label, value] of Object.entries(VISA)) {
            await page.getByRole('textbox', { name: new RegExp(`^${label}`) }).fill(value);
        }
        await page.getByRole('textbox', { name: /^AEGEE experience/ }).fill('Two local trainings');
        await page.getByRole('textbox', { name: /^Ideal SU/ }).fill('Mountains and new friends');
        await page.getByRole('textbox', { name: /^Motivation/ }).fill('I want to learn a language');
        await page.getByRole('textbox', { name: /^Why this SU\?/ }).fill('Because of the mountains');
        // Buefy hides the consent boxes under their text, which is what a member clicks.
        await page.getByText(/I agree with my personal data to be processed/).click();
        await page.getByText(/I confirm that I have read and understood the regulations/).click();
        await page.getByRole('button', { name: 'Save application!' }).click();

        await expect(page.getByRole('alert').or(page.getByRole('status')).filter({ hasText: 'Your application was saved, you can still edit it until the application period ends' })).toBeVisible();
        await expect(page).toHaveURL(`/summeruniversity/${event.url}`);

        const application = await asSu<StoredApplication>(api, 'member', 'GET', `/single/${event.id}/applications/me`);
        expect(application).toMatchObject({
            user_id: applicant.id,
            body_id: applicant.bodies[0].id,
            nationality: 'Belgian',
            travelling_from: 'Belgium',
            meals: 'Vegan',
            visa_required: true,
            visa_passport_number: VISA['Passport number'],
            visa_country: VISA.Country,
            answers: ['Because of the mountains'],
            status: 'pending'
        });

        // The mails of the application: to the applicant, to the organisers, and to the board of
        // the applicant's body, which summeruniversity looks up in core.
        const mailOf = async (template: string): Promise<Mail> => {
            let found: Mail | undefined;
            await expect.poll(async () => {
                found = (await api.mails()).find((mail) => mail.template === template && (mail.parameters.application as { id?: number } | undefined)?.id === application.id);
                return found;
            }, { message: `a ${template} mail about application ${application.id}` }).toBeTruthy();
            return found as Mail;
        };

        expect(recipients(await mailOf('summeruniversity_applied.html'))).toEqual([applicant.email]);

        const organisers = await Promise.all((['suct', 'admin', 'netcom', 'nd'] as const).map((username) => api.me(username)));
        expect(recipients(await mailOf('summeruniversity_organizer_applied.html'))).toEqual(organisers.map((organiser) => organiser.email).sort());

        const board = await api.call<Envelope<BodyMembership[]>>(
            'admin',
            'GET',
            `/api/core/bodies/${applicant.bodies[0].id}/members?holds_permission[action]=approve_members&holds_permission[object]=summeruniversity`
        );
        expect(board.status, JSON.stringify(board.body)).toBe(200);
        const boardEmails = board.body.data.map((membership) => membership.user.notification_email).sort();
        expect(boardEmails, 'the seeded board of the applicant\'s antenna').toContain((await api.me('board')).email);
        expect(recipients(await mailOf('summeruniversity_board_applied.html'))).toEqual(boardEmails);
    });
});
