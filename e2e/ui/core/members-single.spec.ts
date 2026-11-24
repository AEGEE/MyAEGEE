// A member's profile (/members/:id): the facts about them, and what the viewer may do with
// them. The dialogs of the page are here; the three modals are in members-single-modals.spec.ts.
import type { Page } from '@playwright/test';

import type { ApiMock } from '../support/api-mock.ts';
import { FIXED_NOW, forbidden, iso, notFound, ok, validationError } from '../support/factories/base.ts';
import { body, circle, member, type Member } from '../support/factories/core.ts';
import { eventApplicationBan, futureApplication } from '../support/factories/core-members.ts';
import { dialog, freezeTime, openAccountMenu, permissionsFor, toast } from '../support/shell.ts';
import { mockEverything } from '../support/smoke/index.ts';
import { test, expect } from '../support/test.ts';

// The value next to a label in the facts table.
const fact = (page: Page, label: string) => page.getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: label, exact: true }) })
    .getByRole('cell');

interface Shown {
    // What GET /members/:id/my_permissions answers.
    global?: string[];
    // What GET /bodies/:id/my_permissions answers, per body of the member.
    perBody?: Record<number, string[]>;
}

// The member on the page, and what the viewer may do with them. `/members/me` is the route of
// the logged-in member too: it stays theirs unless the page shows them.
const showMember = (api: ApiMock, me: Member | null, data: Member, { global = [], perBody = {} }: Shown = {}, path = data.username || String(data.id)) => {
    api.on('GET core /members/:id', ({ params }) => {
        if (params.id === 'me') return { json: ok(me) };
        return params.id === data.username || params.id === String(data.id)
            ? { json: ok(data) }
            : { status: 404, json: notFound('User is not found.') };
    });
    permissionsFor(api, 'members', path, global);
    for (const { id } of data.bodies) permissionsFor(api, 'bodies', id, perBody[id] ?? []);
};

const ANTENNA = body({ id: 1, name: 'AEGEE-Antenna', code: 'ANT', description: 'The local antenna' });
const OTHER = body({ id: 7, name: 'AEGEE-Brussels', code: 'BRU', description: 'Another antenna' });
const COMMISSION = body({ id: 8, name: 'Audit Commission', code: 'AUD', type: 'commission', description: 'Checks the finances' });

const ALEX = (overrides: Partial<Member> = {}) => member({
    id: 42,
    username: 'alex.member',
    first_name: 'Alex',
    last_name: 'Member',
    email: 'alex@example.org',
    notification_email: 'alex@example.org',
    phone: '+32 2 123 45 67',
    date_of_birth: '1999-05-01',
    gender: 'Female',
    address: 'Rue de la Loi 1',
    about_me: 'Likes trains',
    bodies: [ANTENNA],
    ...overrides
});

const ACTIONS = ['Change picture', 'Change email', 'Set primary email', 'Set primary body', 'Suspend user', 'Activate user',
    'Ban event applications', 'Lift event application ban', 'Add superadmin status', 'Remove superadmin status', 'Delete profile'];

// The buttons and links of the action panel that the page shows.
const expectActions = async (page: Page, shown: string[]) => {
    for (const action of ACTIONS) {
        await expect(page.getByRole('button', { name: action, exact: true })).toHaveCount(shown.includes(action) ? 1 : 0);
    }
    for (const link of ['Edit profile', 'Change password']) {
        await expect(page.getByRole('link', { name: link, exact: true })).toHaveCount(shown.includes(link) ? 1 : 0);
    }
};

// Both names of the permission to suspend members: the page checks one, the server the other.
const SUSPEND = ['global:update_active:member', 'global:update_active:user'];

test.describe('member page', () => {
    test('shows the facts about the member', async ({ page, api, me }) => {
        showMember(api, me, ALEX({ superadmin: false, active: true, gsuite_id: 'alex.member@aegee.eu' }));

        await page.goto('/members/alex.member');

        await expect(page.getByRole('heading', { name: 'Alex', level: 1 })).toBeVisible();
        await expect(page.getByText('Member', { exact: true })).toBeVisible();
        await expect(page).toHaveTitle('MyAEGEE | View single member');
        const profileLink = fact(page, 'Profile link').getByRole('link');
        await expect(profileLink).toHaveText('https://my.aegee.eu/members/alex.member');
        await expect(profileLink).toHaveAttribute('href', '/members/alex.member');
        await expect(fact(page, 'Primary body').getByRole('link', { name: 'AEGEE-Antenna' })).toHaveAttribute('href', '/bodies/1');
        await expect(fact(page, 'Phone')).toHaveText('+32 2 123 45 67');
        await expect(fact(page, 'Date of birth')).toHaveText('1999-05-01');
        await expect(fact(page, 'Gender')).toHaveText('Female');
        await expect(fact(page, 'Address')).toHaveText('Rue de la Loi 1');
        await expect(fact(page, 'About me')).toHaveText('Likes trains');
        await expect(fact(page, 'Is superadmin?')).toHaveText('No');
        await expect(fact(page, 'Notification email').getByRole('link', { name: 'alex@example.org' })).toHaveAttribute('href', 'mailto:alex@example.org');
        await expect(fact(page, 'Google Workspace account').getByRole('link', { name: 'alex.member@aegee.eu' })).toHaveAttribute('href', 'mailto:alex.member@aegee.eu');
        await expect(fact(page, 'Login suspended?')).toHaveText('No');
        // Without a picture the page shows the logo, which says nothing about the member.
        await expect(page.getByRole('img', { name: /Profile picture/ })).toHaveCount(0);
    });

    test('fits the width of a phone, also with a long username', { tag: '@phone-only' }, async ({ page, api, me }) => {
        showMember(api, me, ALEX({ username: 'alexandra.member-of-a-long-named-antenna' }));

        await page.goto('/members/alexandra.member-of-a-long-named-antenna');

        await expect(fact(page, 'Profile link')).toContainText('alexandra.member-of-a-long-named-antenna');
        // Nothing sticks out to the side, so the phone doesn't zoom the page out.
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    });

    test('the notification email link mails the address it shows', async ({ page, api, me }) => {
        // The member reads their mail on their Workspace account.
        showMember(api, me, ALEX({ email: 'alex@example.org', gsuite_id: 'alex.member@aegee.eu', primary_email: 'gsuite', notification_email: 'alex.member@aegee.eu' }));

        await page.goto('/members/alex.member');

        await expect(fact(page, 'Notification email').getByRole('link', { name: 'alex.member@aegee.eu' })).toHaveAttribute('href', 'mailto:alex.member@aegee.eu');
    });

    test('shows "Not set." without a primary body or Workspace account, and a superadmin who is suspended', async ({ page, api, me }) => {
        showMember(api, me, ALEX({ primary_body_id: null, primary_body: null, gsuite_id: null, superadmin: true, active: false }));

        await page.goto('/members/alex.member');

        await expect(fact(page, 'Primary body')).toHaveText('Not set.');
        await expect(fact(page, 'Google Workspace account')).toHaveText('Not set.');
        await expect(fact(page, 'Is superadmin?')).toHaveText('Yes');
        await expect(fact(page, 'Login suspended?')).toHaveText('Yes');
    });

    test('shows the member\'s picture', async ({ page, api, me }) => {
        showMember(api, me, ALEX({ image: 'alex.png' }));
        api.url('GET', '/media/core/headimages/*', { body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'), contentType: 'image/png' });

        await page.goto('/members/alex.member');

        await expect(page.getByRole('img', { name: 'Profile picture of Alex Member' })).toHaveAttribute('src', '/media/core/headimages/alex.png');
        expect(api.callsTo('GET url /media/core/headimages/*').map((call) => new URL(call.path).pathname)).toEqual(['/media/core/headimages/alex.png']);
    });

    test('lists the bodies with the primary body first, and the circles', async ({ page, api, me }) => {
        showMember(api, me, ALEX({
            bodies: [ANTENNA, COMMISSION, OTHER],
            primary_body_id: 7,
            primary_body: OTHER,
            circles: [circle({ id: 12, name: 'Members AEGEE-Antenna', description: 'Everyone in the antenna' })]
        }));

        await page.goto('/members/alex.member');

        await expect(page.getByRole('heading', { name: 'Bodies' })).toBeVisible();
        const bodies = page.getByRole('table').filter({ has: page.getByRole('link', { name: 'BRU', exact: true }) });
        await expect(bodies.getByRole('row')).toHaveText([/Code\s*Name\s*Description/, /BRU\s*AEGEE-Brussels\s*Primary\s*Another antenna/, /ANT\s*AEGEE-Antenna\s*The local antenna/, /AUD\s*Audit Commission\s*Checks the finances/]);
        await expect(bodies.getByRole('link', { name: 'BRU' })).toHaveAttribute('href', '/bodies/7');
        await expect(bodies.getByText('Primary', { exact: true })).toHaveCount(1);

        await expect(page.getByRole('heading', { name: 'Circles' })).toBeVisible();
        const circles = page.getByRole('table').filter({ has: page.getByRole('link', { name: 'Members AEGEE-Antenna' }) });
        await expect(circles.getByRole('link', { name: 'Members AEGEE-Antenna' })).toHaveAttribute('href', '/circles/12');
        await expect(circles.getByRole('row').nth(1)).toContainText('Everyone in the antenna');
    });

    test('a member without bodies and circles has neither section', async ({ page, api, me }) => {
        showMember(api, me, ALEX({ bodies: [], primary_body_id: null, primary_body: null, circles: [] }));

        await page.goto('/members/alex.member');

        await expect(fact(page, 'Primary body')).toHaveText('Not set.');
        await expect(page.getByRole('heading', { name: 'Bodies' })).toHaveCount(0);
        await expect(page.getByRole('heading', { name: 'Circles' })).toHaveCount(0);
    });

    test('a member looking at someone else without permissions sees no actions and no ban', async ({ page, api, me }) => {
        showMember(api, me, ALEX({ gsuite_id: 'alex.member@aegee.eu' }));

        await page.goto('/members/alex.member');

        await expect(fact(page, 'Login suspended?')).toHaveText('No');
        await expectActions(page, []);
        await expect(page.getByRole('rowheader', { name: 'Event application ban' })).toHaveCount(0);
    });

    test('the own profile has the actions a member may take on it', async ({ page, api, me }) => {
        me!.username = 'alex.member';
        showMember(api, me, member({ ...me!, gsuite_id: null }));

        await page.goto('/members/alex.member');

        await expectActions(page, ['Change picture', 'Edit profile', 'Change password', 'Change email', 'Set primary body']);
        await expect(page.getByRole('link', { name: 'Edit profile' })).toHaveAttribute('href', '/members/alex.member/edit');
        await expect(page.getByRole('link', { name: 'Change password' })).toHaveAttribute('href', '/members/edituser');
        // Members see their own ban.
        await expect(fact(page, 'Event application ban')).toHaveText('No active ban');
    });

    test('a member with a Workspace account can also choose their primary email', async ({ page, api, me }) => {
        me!.gsuite_id = 'alex.member@aegee.eu';
        showMember(api, me, me!, {}, 'me');

        await page.goto('/members/me');

        await expect(page.getByRole('button', { name: 'Set primary email' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Change password' })).toBeVisible();
    });

    test('members who may suspend others get no button to suspend themselves', async ({ page, api, me }) => {
        // Core refuses it: "You cannot suspend yourself."
        showMember(api, me, me!, { global: [...SUSPEND] }, 'me');

        await page.goto('/members/me');

        await expect(page.getByRole('link', { name: 'Change password' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Suspend user' })).toHaveCount(0);
    });

    test('an empty Workspace account gives no primary email choice', async ({ page, api, me }) => {
        me!.gsuite_id = '';
        showMember(api, me, me!, {}, 'me');

        await page.goto('/members/me');

        await expect(page.getByRole('button', { name: 'Set primary body' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Set primary email' })).toHaveCount(0);
    });

    test('a board member of one of the member\'s bodies may edit them', async ({ page, api, me }) => {
        showMember(api, me, ALEX({ bodies: [ANTENNA, OTHER], gsuite_id: 'alex.member@aegee.eu' }), { perBody: { 7: ['local:update:member'] } });

        await page.goto('/members/alex.member');

        await expectActions(page, ['Change picture', 'Edit profile', 'Change email', 'Set primary email', 'Set primary body']);
        await expect(page.getByRole('rowheader', { name: 'Event application ban' })).toHaveCount(0);
    });

    for (const [permissions, actions] of [
        [SUSPEND, ['Suspend user']],
        [['global:update_application_ban:member'], ['Ban event applications']],
        [['global:update_superadmin:member'], ['Add superadmin status']],
        [['global:delete:member'], ['Delete profile']]
    ] as const) {
        test(`${permissions.join(' and ')} gives only "${actions.join('", "')}"`, async ({ page, api, me }) => {
            showMember(api, me, ALEX({ active: true, superadmin: false }), { global: [...permissions] });

            await page.goto('/members/alex.member');

            await expectActions(page, [...actions]);
        });
    }

    test('a local permission to ban gives no ban buttons', async ({ page, api, me }) => {
        showMember(api, me, ALEX(), { perBody: { 1: ['local:update_application_ban:member'] } });

        await page.goto('/members/alex.member');

        await expect(fact(page, 'Login suspended?')).toHaveText('No');
        await expectActions(page, []);
    });

    test('the ban row shows until when a ban runs, and nothing for an expired one', async ({ page, api, me }) => {
        await freezeTime(page);
        const now = Date.parse(FIXED_NOW);
        showMember(api, me, ALEX({ event_application_ban: eventApplicationBan({ ban_until: '2027-03-20T09:00:00.000Z' }) }), { global: ['global:update_application_ban:member'] });

        await page.goto('/members/alex.member');

        await expect(fact(page, 'Event application ban')).toHaveText('Until 2027-03-20 10:00');
        await expect(page.getByRole('button', { name: 'Lift event application ban' })).toBeVisible();

        showMember(api, me, ALEX({ event_application_ban: eventApplicationBan({ ban_until: iso(-1, now) }) }), { global: ['global:update_application_ban:member'] });
        await page.reload();

        await expect(fact(page, 'Event application ban')).toHaveText('No active ban');
        await expect(page.getByRole('button', { name: 'Ban event applications' })).toBeVisible();
    });

    test('deleting asks first, then goes to the members list', async ({ page, api, me }) => {
        showMember(api, me, ALEX(), { global: ['global:delete:member'] });
        api.json('DELETE core /members/:id', { success: true, message: 'User is deleted.' });
        api.fallback(mockEverything);
        await page.goto('/members/alex.member');

        await page.getByRole('button', { name: 'Delete profile' }).click();
        const confirm = dialog(page, 'Deleting a user');
        await expect(confirm).toContainText('Are you sure you want to delete this user? This action cannot be undone.');
        await confirm.getByRole('button', { name: 'Cancel' }).click();
        await expect(confirm).toBeHidden();
        expect(api.callsTo('DELETE core /members/:id')).toHaveLength(0);

        await page.getByRole('button', { name: 'Delete profile' }).click();
        await dialog(page, 'Deleting a user').getByRole('button', { name: 'Delete user' }).click();

        await expect(toast(page, 'User is deleted.')).toBeVisible();
        await expect(page).toHaveURL('/members');
        expect(api.callsTo('DELETE core /members/:id').map((call) => [call.params.id, call.body])).toEqual([['42', undefined]]);
    });

    test('a refused delete says why and stays', async ({ page, api, me }) => {
        showMember(api, me, ALEX(), { global: ['global:delete:member'] });
        api.on('DELETE core /members/:id', { status: 403, json: forbidden('Permission delete:member is required, but not present.') });
        await page.goto('/members/alex.member');

        await page.getByRole('button', { name: 'Delete profile' }).click();
        await dialog(page, 'Deleting a user').getByRole('button', { name: 'Delete user' }).click();

        await expect(toast(page, 'Could not delete user: Permission delete:member is required, but not present.')).toBeVisible();
        await expect(page).toHaveURL('/members/alex.member');
    });

    test('suspending and activating ask first and change the login state', async ({ page, api, me }) => {
        showMember(api, me, ALEX({ active: true }), { global: SUSPEND });
        api.on('PUT core /members/:id/active', ({ body: sent }) => ({ json: ok(ALEX({ active: (sent as { active: boolean }).active })), delayMs: 1000 }));
        await page.goto('/members/alex.member');

        await page.getByRole('button', { name: 'Suspend user' }).click();
        const suspend = dialog(page, 'Suspend user');
        await expect(suspend).toContainText('Are you sure you want to suspend this user?');
        await suspend.getByRole('button', { name: 'Suspend user' }).click();

        // No second click while the change is saved.
        await expect(suspend).toBeHidden();
        await expect(page.getByRole('button', { name: 'Suspend user' })).toBeDisabled();
        await expect(toast(page, 'User is suspended.')).toBeVisible();
        await expect(fact(page, 'Login suspended?')).toHaveText('Yes');

        await page.getByRole('button', { name: 'Activate user' }).click();
        const activate = dialog(page, 'Activate user');
        await expect(activate).toContainText('Are you sure you want to activate this user?');
        await activate.getByRole('button', { name: 'Activate user' }).click();

        await expect(activate).toBeHidden();
        await expect(toast(page, 'User is activated.')).toBeVisible();
        await expect(fact(page, 'Login suspended?')).toHaveText('No');
        await expect(page.getByRole('button', { name: 'Suspend user' })).toBeEnabled();
        expect(api.callsTo('PUT core /members/:id/active').map((call) => [call.params.id, call.body])).toEqual([['42', { active: false }], ['42', { active: true }]]);
    });

    test('a refused suspension says why and changes nothing', async ({ page, api, me }) => {
        showMember(api, me, ALEX({ active: true }), { global: SUSPEND });
        api.on('PUT core /members/:id/active', { status: 403, json: forbidden('Permission update_active:user is required, but not present.') });
        await page.goto('/members/alex.member');

        await page.getByRole('button', { name: 'Suspend user' }).click();
        await dialog(page, 'Suspend user').getByRole('button', { name: 'Suspend user' }).click();

        await expect(dialog(page, 'Suspend user')).toBeHidden();
        await expect(toast(page, 'Error changing user status: Permission update_active:user is required, but not present.')).toBeVisible();
        await expect(fact(page, 'Login suspended?')).toHaveText('No');
        await expect(page.getByRole('button', { name: 'Suspend user' })).toBeEnabled();
    });

    test('superadmin status is added and removed after asking', async ({ page, api, me }) => {
        showMember(api, me, ALEX({ superadmin: false }), { global: ['global:update_superadmin:member'] });
        api.on('PUT core /members/:id/superadmin', ({ body: sent }) => ({ json: ok(ALEX({ superadmin: (sent as { superadmin: boolean }).superadmin })), delayMs: 1000 }));
        await page.goto('/members/alex.member');

        await page.getByRole('button', { name: 'Add superadmin status' }).click();
        const add = dialog(page, 'Add superadmin status');
        await expect(add).toContainText('Are you sure you want to add superadmin status for this user?');
        await add.getByRole('button', { name: 'Add superadmin status' }).click();

        // No second click while the change is saved.
        await expect(add).toBeHidden();
        await expect(page.getByRole('button', { name: 'Add superadmin status' })).toBeDisabled();
        await expect(toast(page, 'User has superadmin powers')).toBeVisible();
        await expect(fact(page, 'Is superadmin?')).toHaveText('Yes');

        await page.getByRole('button', { name: 'Remove superadmin status' }).click();
        const remove = dialog(page, 'Remove superadmin status');
        await expect(remove).toContainText('Are you sure you want to remove superadmin status for this user?');
        await remove.getByRole('button', { name: 'Remove superadmin status' }).click();

        await expect(remove).toBeHidden();
        await expect(toast(page, 'User has no superadmin powers')).toBeVisible();
        await expect(fact(page, 'Is superadmin?')).toHaveText('No');
        expect(api.callsTo('PUT core /members/:id/superadmin').map((call) => [call.params.id, call.body])).toEqual([['42', { superadmin: true }], ['42', { superadmin: false }]]);
    });

    test('a refused superadmin change says why', async ({ page, api, me }) => {
        showMember(api, me, ALEX({ superadmin: true }), { global: ['global:update_superadmin:member'] });
        api.on('PUT core /members/:id/superadmin', { status: 403, json: forbidden('Permission global:update_superadmin:member is required, but not present.') });
        await page.goto('/members/alex.member');

        await page.getByRole('button', { name: 'Remove superadmin status' }).click();
        await dialog(page, 'Remove superadmin status').getByRole('button', { name: 'Remove superadmin status' }).click();

        await expect(dialog(page, 'Remove superadmin status')).toBeHidden();
        await expect(toast(page, 'Error changing superadmin powers: Permission global:update_superadmin:member is required, but not present.')).toBeVisible();
        await expect(fact(page, 'Is superadmin?')).toHaveText('Yes');
        await expect(page.getByRole('button', { name: 'Remove superadmin status' })).toBeEnabled();
    });

    test.describe('banning from event applications', () => {
        const BANNER = { global: ['global:update_application_ban:member'] };
        const future = (api: ApiMock, events: ReturnType<typeof futureApplication>[], statutory: ReturnType<typeof futureApplication>[] = [], summeruniversity: ReturnType<typeof futureApplication>[] = []) => {
            api.json('GET events /applications/future/:user_id', ok(events));
            api.json('GET statutory /applications/future/:user_id', ok(statutory));
            api.json('GET summeruniversity /applications/future/:user_id', ok(summeruniversity));
        };
        const askBan = async (page: Page, until: string) => {
            await page.getByRole('button', { name: 'Ban event applications' }).click();
            const prompt = dialog(page, 'Ban event applications');
            await expect(prompt).toContainText('Set the end date of the temporary ban. The maximum is 3 months from today.');
            await prompt.getByLabel('Ban until').fill(until);
            await prompt.getByRole('button', { name: 'OK' }).click();
        };

        test('lists the member\'s future applications and applies the ban', async ({ page, api, me }) => {
            await freezeTime(page);
            showMember(api, me, ALEX(), BANNER);
            future(
                api,
                [futureApplication({ service: 'events', event_name: '<b>Spring</b> Training', application_status: 'accepted' })],
                [futureApplication({ service: 'statutory', event_name: 'Agora Brussels', application_status: 'pending' })],
                [futureApplication({ service: 'summeruniversity', event_name: 'SU Lisbon', application_status: 'pending' })]
            );
            api.json('PUT core /members/:id/event-application-ban', ok(eventApplicationBan({ user_id: 42, ban_until: '2027-03-15T00:00:00.000Z' })));
            await page.goto('/members/alex.member');

            // From tomorrow to three months from today.
            await page.getByRole('button', { name: 'Ban event applications' }).click();
            const until = dialog(page, 'Ban event applications').getByLabel('Ban until');
            await expect(until).toHaveAttribute('type', 'date');
            await expect(until).toHaveAttribute('min', '2027-03-02');
            await expect(until).toHaveAttribute('max', '2027-06-01');
            await until.fill('2027-03-15');
            await dialog(page, 'Ban event applications').getByRole('button', { name: 'OK' }).click();

            const confirm = dialog(page, 'Confirm event application ban');
            await expect(confirm).toContainText('This user already has future applications. These applications will remain active:');
            await expect(confirm.getByRole('listitem')).toHaveText([
                '<b>Spring</b> Training (events, accepted)',
                'Agora Brussels (statutory, pending)',
                'SU Lisbon (summeruniversity, pending)'
            ]);
            await expect(confirm).toContainText('Do you want to apply the ban until 2027-03-15?');
            await confirm.getByRole('button', { name: 'Apply ban' }).click();

            await expect(toast(page, 'Event application ban is active.')).toBeVisible();
            await expect(fact(page, 'Event application ban')).toHaveText('Until 2027-03-15 01:00');
            await expect(page.getByRole('button', { name: 'Lift event application ban' })).toBeEnabled();
            for (const service of ['events', 'statutory', 'summeruniversity']) {
                expect(api.callsTo(`GET ${service} /applications/future/:user_id`).map((call) => call.params.user_id)).toEqual(['42']);
            }
            expect(api.callsTo('PUT core /members/:id/event-application-ban').map((call) => [call.params.id, call.body])).toEqual([['42', { ban_until: '2027-03-15' }]]);
        });

        test('a date more than three months away is not accepted', async ({ page, api, me }) => {
            await freezeTime(page);
            showMember(api, me, ALEX(), BANNER);
            await page.goto('/members/alex.member');

            await askBan(page, '2027-07-01');

            await expect(dialog(page, 'Ban event applications')).toBeVisible();
            expect(api.callsTo('GET events /applications/future/:user_id')).toHaveLength(0);
        });

        test('says when the member has no future applications; cancelling applies nothing', async ({ page, api, me }) => {
            await freezeTime(page);
            showMember(api, me, ALEX(), BANNER);
            future(api, []);
            await page.goto('/members/alex.member');

            await askBan(page, '2027-03-15');
            const confirm = dialog(page, 'Confirm event application ban');
            await expect(confirm).toContainText('This user has no active future applications.');
            await confirm.getByRole('button', { name: 'Cancel' }).click();

            await expect(confirm).toBeHidden();
            await expect(page.getByRole('button', { name: 'Ban event applications' })).toBeEnabled();
            await expect(fact(page, 'Event application ban')).toHaveText('No active ban');
            expect(api.callsTo('PUT core /members/:id/event-application-ban')).toHaveLength(0);
        });

        test('stops when the future applications cannot be loaded', async ({ page, api, me }) => {
            await freezeTime(page);
            showMember(api, me, ALEX(), BANNER);
            api.json('GET events /applications/future/:user_id', ok([]));
            api.on('GET statutory /applications/future/:user_id', { status: 403, json: forbidden('You are not allowed to see future applications.') });
            api.json('GET summeruniversity /applications/future/:user_id', ok([]));
            await page.goto('/members/alex.member');

            await askBan(page, '2027-03-15');

            await expect(toast(page, 'Could not fetch future applications: You are not allowed to see future applications.')).toBeVisible();
            await expect(dialog(page, 'Confirm event application ban')).toHaveCount(0);
            await expect(page.getByRole('button', { name: 'Ban event applications' })).toBeEnabled();
            expect(api.callsTo('PUT core /members/:id/event-application-ban')).toHaveLength(0);
        });

        test('shows why the server refused the date', async ({ page, api, me }) => {
            await freezeTime(page);
            showMember(api, me, ALEX(), BANNER);
            future(api, []);
            api.on('PUT core /members/:id/event-application-ban', { status: 422, json: validationError({ ban_until: ['Ban end date should be in the future.'] }) });
            await page.goto('/members/alex.member');

            await askBan(page, '2027-03-15');
            await dialog(page, 'Confirm event application ban').getByRole('button', { name: 'Apply ban' }).click();

            await expect(toast(page, 'Error setting event application ban: Ban end date should be in the future.')).toBeVisible();
            await expect(fact(page, 'Event application ban')).toHaveText('No active ban');
            await expect(page.getByRole('button', { name: 'Ban event applications' })).toBeEnabled();
        });

        test('lifting asks first and ends the ban', async ({ page, api, me }) => {
            await freezeTime(page);
            showMember(api, me, ALEX({ event_application_ban: eventApplicationBan({ ban_until: '2027-03-20T09:00:00.000Z' }) }), BANNER);
            api.json('DELETE core /members/:id/event-application-ban', { success: true, message: 'Event application ban was lifted.' });
            await page.goto('/members/alex.member');

            await page.getByRole('button', { name: 'Lift event application ban' }).click();
            const confirm = dialog(page, 'Lift event application ban');
            await expect(confirm).toContainText('Are you sure you want to lift this user\'s event application ban?');
            await confirm.getByRole('button', { name: 'Lift ban' }).click();

            await expect(toast(page, 'Event application ban is lifted.')).toBeVisible();
            await expect(fact(page, 'Event application ban')).toHaveText('No active ban');
            await expect(page.getByRole('button', { name: 'Ban event applications' })).toBeEnabled();
            expect(api.callsTo('DELETE core /members/:id/event-application-ban').map((call) => call.params.id)).toEqual(['42']);
        });

        test('a ban that cannot be lifted stays', async ({ page, api, me }) => {
            await freezeTime(page);
            showMember(api, me, ALEX({ event_application_ban: eventApplicationBan({ ban_until: '2027-03-20T09:00:00.000Z' }) }), BANNER);
            api.on('DELETE core /members/:id/event-application-ban', { status: 404, json: notFound('This user does not have an active event application ban.') });
            await page.goto('/members/alex.member');

            await page.getByRole('button', { name: 'Lift event application ban' }).click();
            await dialog(page, 'Lift event application ban').getByRole('button', { name: 'Lift ban' }).click();

            await expect(toast(page, 'Error lifting event application ban: This user does not have an active event application ban.')).toBeVisible();
            await expect(fact(page, 'Event application ban')).toHaveText('Until 2027-03-20 10:00');
            await expect(page.getByRole('button', { name: 'Lift event application ban' })).toBeEnabled();
        });
    });

    test.describe('changing the email', () => {
        const askChange = async (page: Page, email: string) => {
            await page.getByRole('button', { name: 'Change email' }).click();
            await dialog(page, 'Change email').getByRole('textbox', { name: 'New email' }).fill(email);
            await dialog(page, 'Change email').getByRole('button', { name: 'OK' }).click();
        };

        test('a global member manager is told the new address has to confirm', async ({ page, api, me }) => {
            showMember(api, me, ALEX(), { global: ['global:update:member'] });
            api.json('PUT core /members/:id/email', {
                success: true,
                message: 'The email change was requested. It takes effect after it is confirmed from the new address.',
                data: { needs_old_address_confirmation: false }
            });
            await page.goto('/members/alex.member');

            await askChange(page, 'alex.new@example.org');

            await expect(toast(page, 'The email change was requested. It takes effect after it is confirmed from the new address.')).toBeVisible();
            expect(api.callsTo('PUT core /members/:id/email').map((call) => [call.params.id, call.body])).toEqual([['42', { new_email: 'alex.new@example.org' }]]);
        });

        test('a board member is told that the current address has to confirm too', async ({ page, api, me }) => {
            const message = 'The email change was requested. The member has to confirm it from both their current address and the new address; a mail was sent to each. If the member can no longer read their current address, ask the MyAEGEE Helpdesk (http://aegee.org/helpdesk) to change the email: it can do that without this confirmation.';
            showMember(api, me, ALEX(), { perBody: { 1: ['local:update:member'] } });
            api.json('PUT core /members/:id/email', { success: true, message, data: { needs_old_address_confirmation: true } });
            await page.goto('/members/alex.member');

            await askChange(page, 'alex.new@example.org');

            // It stays on the page until it is closed.
            await expect(page.getByText(message)).toBeVisible();
            await page.getByRole('button', { name: 'Close' }).click();
            await expect(page.getByText(message)).toHaveCount(0);
        });

        test('an email change whose mail could not be sent says so', async ({ page, api, me }) => {
            showMember(api, me, ALEX(), { global: ['global:update:member'] });
            api.on('PUT core /members/:id/email', { status: 503, json: { success: false, message: 'The mail could not be sent, so nothing was saved. Please try again later.' } });
            await page.goto('/members/alex.member');

            await askChange(page, 'alex.new@example.org');

            await expect(toast(page, /The mail could not be sent, so nothing was saved\. Please try again later\./)).toBeVisible();
            expect(api.callsTo('PUT core /members/:id/email').map((call) => call.body)).toEqual([{ new_email: 'alex.new@example.org' }]);
        });

        test('the own email change gets the general message when the server sends none', async ({ page, api, me }) => {
            showMember(api, me, member({ ...me! }), {}, 'me');
            api.json('PUT core /members/:id/email', { success: true });
            await page.goto('/members/me');

            await askChange(page, 'alex.new@example.org');

            await expect(toast(page, 'An email change is triggered. Check your new inbox for a confirmation.')).toBeVisible();
            expect(api.callsTo('PUT core /members/:id/email').map((call) => call.params.id)).toEqual([String(me!.id)]);
        });

        test('a refused change says why; cancelling sends nothing', async ({ page, api, me }) => {
            showMember(api, me, ALEX(), { global: ['global:update:member'] });
            api.on('PUT core /members/:id/email', { status: 422, json: { success: false, message: 'User with this email already exists.' } });
            await page.goto('/members/alex.member');

            await page.getByRole('button', { name: 'Change email' }).click();
            await dialog(page, 'Change email').getByRole('button', { name: 'Cancel' }).click();
            await expect(dialog(page, 'Change email')).toHaveCount(0);
            expect(api.callsTo('PUT core /members/:id/email')).toHaveLength(0);

            await askChange(page, 'taken@example.org');

            await expect(toast(page, 'Error changing user email: User with this email already exists.')).toBeVisible();
        });
    });

    test('an unknown member goes back to the members list', async ({ page, api, me }) => {
        api.on('GET core /members/:id', ({ params }) => (params.id === 'me' ? { json: ok(me) } : { status: 404, json: notFound('User is not found.') }));
        api.fallback(mockEverything);

        await page.goto('/members/nobody');

        await expect(toast(page, 'User is not found')).toBeVisible();
        await expect(page).toHaveURL('/members');
    });

    test('goes back to the members list when the permissions in a body cannot be loaded', async ({ page, api, me }) => {
        api.on('GET core /members/:id', ({ params }) => ({ json: ok(params.id === 'me' ? me : ALEX()) }));
        permissionsFor(api, 'members', 'alex.member', []);
        api.on('GET core /bodies/:id/my_permissions', { status: 500, json: { success: false, message: 'Something went wrong on the server.' } });
        api.fallback(mockEverything);

        await page.goto('/members/alex.member');

        await expect(toast(page, 'Some error happened: Something went wrong on the server.')).toBeVisible();
        await expect(page).toHaveURL('/members');
    });

    test('"See my account" on someone else\'s page shows the own profile', async ({ page, api, me, layout }) => {
        showMember(api, me, ALEX());
        permissionsFor(api, 'members', 'me', []);
        await page.goto('/members/alex.member');
        await expect(page.getByRole('heading', { name: 'Alex', level: 1 })).toBeVisible();
        me!.first_name = 'Mia';

        const menu = await openAccountMenu(page, layout);
        await menu.getByRole('link', { name: 'See my account' }).click();

        await expect(page).toHaveURL('/members/me');
        await expect(page.getByRole('heading', { name: 'Mia', level: 1 })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Change password' })).toBeVisible();
    });

    test('links to the id of a member without a username', async ({ page, api, me }) => {
        showMember(api, me, ALEX({ username: '' }), { global: ['global:update:member'] });

        await page.goto('/members/42');

        await expect(fact(page, 'Profile link').getByRole('link')).toHaveText('https://my.aegee.eu/members/42');
        await expect(fact(page, 'Profile link').getByRole('link')).toHaveAttribute('href', '/members/42');
        await expect(page.getByRole('link', { name: 'Edit profile' })).toHaveAttribute('href', '/members/42/edit');
    });
});
