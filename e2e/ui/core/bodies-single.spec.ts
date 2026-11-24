// The page of one body (/bodies/:id): its facts, its current board and bound circles, what
// members and visitors can do there, and the dialogs it opens (join, leave, delete, add member,
// add bound circle).
import type { Page } from '@playwright/test';

import { forbidden, notFound, ok, validationError } from '../support/factories/base.ts';
import { bodyMembership, circle, memberSearchResult, type BodyMembership } from '../support/factories/core.ts';
import { bodyDetail, type BodyDetail } from '../support/factories/core-bodies.ts';
import { board, type Board } from '../support/factories/network.ts';
import type { ApiMock } from '../support/api-mock.ts';
import { cellOf, dialog, fillDate, permissionsFor, tableRows, toast } from '../support/shell.ts';
import { test, expect } from '../support/test.ts';

interface Answers {
    permissions?: string[];
    boards?: Board[];
    members?: BodyMembership[];
}

// What the page asks for when a member opens it. The members of the body are only asked for
// to put names to a board.
const answer = (api: ApiMock, data: BodyDetail, { permissions = [], boards = [], members = [] }: Answers = {}): void => {
    api.json('GET core /bodies/:id', ok(data));
    api.json('GET network /bodies/:id/boards/current', ok(boards));
    if (boards.length) api.json('GET core /bodies/:id/members', ok(members));
    permissionsFor(api, 'bodies', data.id, permissions);
};

const membership = (id: number, first: string, last: string): BodyMembership => {
    const made = bodyMembership({ body_id: 1, user_id: id });
    return { ...made, user: { ...made.user, first_name: first, last_name: last } };
};

const facts = (page: Page) => page.getByRole('table').first();
const fact = (page: Page, name: string) => facts(page).getByRole('row').filter({ has: page.getByRole('rowheader', { name, exact: true }) });

// Everything a board member of an antenna may do there; today's checks and the service's
// rules both accept this set.
const BOARD = [
    'local:view_members:body', 'global:view:board', 'local:view:join_request', 'local:view:campaign', 'local:add_member:body',
    'local:create:bound_circle', 'global:create:circle', 'local:update:body', 'global:update:body', 'local:manage_network:boards',
    'global:delete:body', 'local:view:shadow_circle'
];

test.describe('the page of a body', () => {
    test('shows the facts of the body', async ({ page, api }) => {
        answer(api, bodyDetail({
            id: 1,
            name: 'AEGEE-Antenna',
            type: 'contact antenna',
            abbreviation: 'ANT',
            description: 'We are **the** antenna',
            task_description: 'Organise _events_',
            code: 'ANT',
            founded_at: '1985-04-15',
            email: 'antenna@example.com',
            phone: '+32 2 123 45 67',
            address: 'Main street 1',
            postal_address: 'PO Box 1',
            website: 'https://antenna.example.org'
        }));

        await page.goto('/bodies/1');

        await expect(page.getByRole('heading', { name: 'AEGEE-Antenna', level: 1 })).toBeVisible();
        await expect(page).toHaveTitle('MyAEGEE | View single body');
        await expect(fact(page, 'Title')).toContainText('AEGEE-Antenna');
        await expect(fact(page, 'Abbreviation')).toHaveCount(0);
        await expect(fact(page, 'Description').getByText('the', { exact: true })).toHaveJSProperty('tagName', 'STRONG');
        await expect(fact(page, 'Task description').getByText('events')).toHaveJSProperty('tagName', 'EM');
        await expect(fact(page, 'Type')).toContainText('Contact antenna');
        await expect(fact(page, 'Code')).toContainText('ANT');
        await expect(fact(page, 'Foundation date')).toContainText('1985-04-15');
        await expect(fact(page, 'Email').getByRole('link', { name: 'antenna@example.com' })).toHaveAttribute('href', 'mailto:antenna@example.com');
        await expect(fact(page, 'Phone')).toContainText('+32 2 123 45 67');
        await expect(fact(page, 'Address')).toContainText('Main street 1');
        await expect(fact(page, 'Postal address')).toContainText('PO Box 1');
        const website = fact(page, 'Website').getByRole('link', { name: 'https://antenna.example.org' });
        await expect(website).toHaveAttribute('href', 'https://antenna.example.org/');
        await expect(website).toHaveAttribute('target', '_blank');
        await expect(fact(page, 'Google Workspace account')).toHaveCount(0);
        await expect(fact(page, 'Shadow circle')).toHaveCount(0);
        await expect(page.getByRole('heading', { name: 'Board' })).toHaveCount(0);
        // A member of the body can leave it, and has nothing else to do here.
        await expect(page.getByRole('button', { name: 'Leave body' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Ask to join body' })).toHaveCount(0);
        for (const name of ['Members', 'Boards', 'Join requests', 'Recruitment campaigns', 'Edit body details']) {
            await expect(page.getByRole('link', { name, exact: true }), name).toHaveCount(0);
        }
        for (const name of ['Add member', 'Add bound circle', 'Change board', 'Delete body', 'Restore body']) {
            await expect(page.getByRole('button', { name }), name).toHaveCount(0);
        }
        await expect.poll(() => api.callsTo('GET network /bodies/:id/boards/current')[0].params).toEqual({ id: '1' });
    });

    test('shows the abbreviation of other bodies and leaves out what is not set', async ({ page, api }) => {
        const missing = { task_description: null, founded_at: null, email: null as unknown as string, phone: null, address: null as unknown as string, postal_address: null, website: null };
        answer(api, bodyDetail({ id: 5, name: 'IT Working Group', type: 'working group', abbreviation: 'ITWG', circles: [], ...missing }));

        await page.goto('/bodies/5');

        await expect(fact(page, 'Abbreviation')).toContainText('ITWG');
        await expect(fact(page, 'Type')).toContainText('Working group');
        await expect(fact(page, 'Email')).toContainText('Not set.');
        for (const name of ['Task description', 'Foundation date', 'Phone', 'Address', 'Postal address', 'Website']) {
            await expect(fact(page, name), name).toHaveCount(0);
        }
        await expect(page.getByRole('heading', { name: 'Bound circles' })).toHaveCount(0);
    });

    test('links a website only when it is a web address', async ({ page, api }) => {
        answer(api, bodyDetail({ id: 5, website: 'www.antenna.example.org' }));

        await page.goto('/bodies/5');

        await expect(fact(page, 'Website').getByRole('link', { name: 'www.antenna.example.org' })).toHaveAttribute('href', 'https://www.antenna.example.org/');
    });

    test('shows a website with a script as text, not as a link', async ({ page, api }) => {
        // The service refuses such links today; older data may still have them.
        // eslint-disable-next-line no-script-url -- the injected link is what the test checks
        answer(api, bodyDetail({ id: 5, website: 'JaVaScRiPt:window.__injected=\'website\'' }));

        await page.goto('/bodies/5');

        const website = 'window.__injected=\'website\'';
        await expect(fact(page, 'Website').getByText(website)).toBeVisible();
        await expect(page.getByRole('link', { name: website })).toHaveCount(0);
    });

    test('renders the description safely', async ({ page, api }) => {
        answer(api, bodyDetail({ id: 5, description: '**Bold** <script>window.__injected=1</script> [click](javascript:alert(1))' }));

        await page.goto('/bodies/5');

        await expect(fact(page, 'Description').getByText('Bold')).toHaveJSProperty('tagName', 'STRONG');
        await expect(fact(page, 'Description').getByText('click')).toBeVisible();
        await expect(fact(page, 'Description').getByRole('link', { name: 'click' })).toHaveCount(0);
        expect(await page.evaluate(() => (window as unknown as { __injected?: unknown }).__injected)).toBeUndefined();
    });

    test('lists the bound circles', async ({ page, api }) => {
        answer(api, bodyDetail({ id: 5, circles: [circle({ id: 61, body_id: 5, name: 'Board of the antenna', description: 'The board' })] }));

        await page.goto('/bodies/5');

        await expect(page.getByRole('heading', { name: 'Bound circles' })).toBeVisible();
        const table = page.getByRole('table').filter({ hasText: 'Board of the antenna' });
        const row = tableRows(table).first();
        await expect(tableRows(table)).toHaveCount(1);
        await expect((await cellOf(table, row, 'Name')).getByRole('link', { name: 'Board of the antenna' })).toHaveAttribute('href', '/circles/61');
        await expect(await cellOf(table, row, 'Description')).toHaveText('The board');
    });

    test('shows the current board with the names of its members', async ({ page, api }) => {
        answer(api, bodyDetail({ id: 1 }), {
            boards: [board({ body_id: 1, name: 'Board 2027', start_date: '2027-01-01', end_date: null, president: 41, secretary: 42, treasurer: 43, other_members: [{ user_id: 44, function: 'Vice-president' }] })],
            members: [membership(41, 'Pia', 'President'), membership(42, 'Sam', 'Secretary'), membership(43, 'Tom', 'Treasurer'), membership(44, 'Val', 'Vice')]
        });

        await page.goto('/bodies/1');

        await expect(page.getByRole('heading', { name: 'Board', exact: true })).toBeVisible();
        const boardTable = page.getByRole('table').nth(1);
        const row = (name: string) => boardTable.getByRole('row').filter({ has: page.getByRole('rowheader', { name, exact: true }) });
        await expect(row('Name')).toContainText('Board 2027');
        await expect(row('Term')).toContainText('2027-01-01 -');
        await expect(row('President')).toContainText('Pia President');
        await expect(row('Secretary')).toContainText('Sam Secretary');
        await expect(row('Treasurer')).toContainText('Tom Treasurer');
        await expect(row('Vice-president')).toContainText('Val Vice');
        await expect.poll(() => api.callsTo('GET core /bodies/:id/members')[0].params).toEqual({ id: '1' });
    });

    test('a board without a name has no name row and shows its full term', async ({ page, api }) => {
        answer(api, bodyDetail({ id: 1 }), {
            boards: [board({ body_id: 1, name: null, start_date: '2027-01-01', end_date: '2027-12-31', president: 41, secretary: 41, treasurer: 41, other_members: [] })],
            members: [membership(41, 'Pia', 'President')]
        });

        await page.goto('/bodies/1');

        const boardTable = page.getByRole('table').nth(1);
        await expect(boardTable.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Term' }) })).toContainText('2027-01-01 - 2027-12-31');
        await expect(boardTable.getByRole('rowheader', { name: 'Name' })).toHaveCount(0);
    });

    test('says nothing when the body has no board', async ({ page, api }) => {
        api.json('GET core /bodies/:id', ok(bodyDetail({ id: 1 })));
        api.on('GET network /bodies/:id/boards/current', { status: 404, json: notFound('No current board') });
        permissionsFor(api, 'bodies', 1, BOARD);

        await page.goto('/bodies/1');

        await expect(page.getByRole('button', { name: 'Change board' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Board', exact: true })).toHaveCount(0);
        await expect(toast(page, 'Some error happened')).toHaveCount(0);
    });

    test('says why the board could not be loaded', async ({ page, api }) => {
        api.json('GET core /bodies/:id', ok(bodyDetail({ id: 1 })));
        api.on('GET network /bodies/:id/boards/current', { status: 500, json: { success: false, message: 'Network is down' } });
        permissionsFor(api, 'bodies', 1, []);

        await page.goto('/bodies/1');

        await expect(toast(page, 'Some error happened: Network is down')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'AEGEE-Test 1', level: 1 })).toBeVisible();
    });

    test('gives a board member the links and buttons of their rights', async ({ page, api }) => {
        const shadow = circle({ id: 62, body_id: 1, name: 'Members of AEGEE-Antenna' });
        answer(api, bodyDetail({ id: 1, type: 'antenna', gsuite_id: 'antenna@aegee.eu', google_group: null, shadow_circle_id: 62, shadow_circle: shadow }), { permissions: BOARD });

        await page.goto('/bodies/1');

        await expect(page.getByRole('link', { name: 'Members', exact: true })).toHaveAttribute('href', '/bodies/1/members');
        await expect(page.getByRole('link', { name: 'Boards', exact: true })).toHaveAttribute('href', '/bodies/1/boards');
        await expect(page.getByRole('link', { name: 'Join requests', exact: true })).toHaveAttribute('href', '/bodies/1/join_requests');
        await expect(page.getByRole('link', { name: 'Recruitment campaigns', exact: true })).toHaveAttribute('href', '/bodies/1/campaigns');
        await expect(page.getByRole('link', { name: 'Edit body details', exact: true })).toHaveAttribute('href', '/bodies/1/edit');
        for (const name of ['Add member', 'Add bound circle', 'Change board', 'Leave body', 'Delete body']) {
            await expect(page.getByRole('button', { name }), name).toBeVisible();
        }
        await expect(fact(page, 'Google Workspace account').getByRole('link', { name: 'antenna@aegee.eu' })).toHaveAttribute('href', 'mailto:antenna@aegee.eu');
        await expect(fact(page, 'Google Group')).toContainText('Not set.');
        await expect(fact(page, 'Shadow circle').getByRole('link', { name: 'Members of AEGEE-Antenna' })).toHaveAttribute('href', '/circles/62');
    });

    test('a body without a shadow circle or Workspace account says so', async ({ page, api }) => {
        answer(api, bodyDetail({ id: 1, gsuite_id: null, google_group: 'group@aegee.eu', shadow_circle: null }), { permissions: ['global:update:body', 'global:view:shadow_circle'] });

        await page.goto('/bodies/1');

        await expect(fact(page, 'Shadow circle')).toContainText('No shadow circle assigned.');
        await expect(fact(page, 'Google Workspace account')).toContainText('Not set.');
        await expect(fact(page, 'Google Group').getByRole('link', { name: 'group@aegee.eu' })).toBeVisible();
    });

    test('the Boards link is only for antennas, contact antennas and contacts', async ({ page, api }) => {
        answer(api, bodyDetail({ id: 5, type: 'working group' }), { permissions: ['global:view:board'] });

        await page.goto('/bodies/5');

        await expect(page.getByRole('button', { name: 'Ask to join body' })).toBeVisible();
        await expect.poll(() => api.callsTo('GET core /bodies/:id/my_permissions').length).toBe(1);
        await expect(page.getByRole('link', { name: 'Boards', exact: true })).toHaveCount(0);
    });

    test('keeps the page when the permissions can\'t be loaded', async ({ page, api }) => {
        api.json('GET core /bodies/:id', ok(bodyDetail({ id: 1 })));
        api.json('GET network /bodies/:id/boards/current', ok([]));
        api.on('GET core /bodies/:id/my_permissions', { status: 500, json: { success: false, message: 'Database is down' } });

        await page.goto('/bodies/1');

        await expect(toast(page, 'Could not fetch your permissions for this body: Database is down')).toBeVisible();
        await expect(page).toHaveURL('/bodies/1');
        await expect(page.getByRole('heading', { name: 'AEGEE-Test 1', level: 1 })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Leave body' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Members', exact: true })).toHaveCount(0);
    });

    test('an unknown body sends the member to the bodies list', async ({ page, api }) => {
        api.on('GET core /bodies/:id', { status: 404, json: notFound('Body is not found.') });
        api.json('GET core /bodies', ok([]));

        await page.goto('/bodies/9');

        await expect(toast(page, 'Body is not found')).toBeVisible();
        await expect(page).toHaveURL('/bodies');
    });

    test('a body that can\'t be shown sends the member to the bodies list', async ({ page, api }) => {
        api.on('GET core /bodies/:id', { status: 403, json: forbidden('Permission view_deleted:body is required, but not present.') });
        api.json('GET core /bodies', ok([]));

        await page.goto('/bodies/9');

        await expect(toast(page, 'Some error happened: Permission view_deleted:body is required, but not present.')).toBeVisible();
        await expect(page).toHaveURL('/bodies');
    });
});

test.describe('the page of a body for a visitor', () => {
    test.use({ session: 'anonymous' });

    test('shows the body and sends those who want to join to the login page', async ({ page, api }) => {
        api.json('GET core /bodies/:id', ok(bodyDetail({ id: 5, name: 'AEGEE-Elsewhere' })));

        await page.goto('/bodies/5');

        await expect(page.getByRole('heading', { name: 'AEGEE-Elsewhere', level: 1 })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Leave body' })).toHaveCount(0);
        await page.getByRole('button', { name: 'Ask to join body' }).click();

        await expect(page).toHaveURL('/login?to=%2Fbodies%2F5');
        expect(api.callsTo('GET network /bodies/:id/boards/current')).toHaveLength(0);
        expect(api.callsTo('GET core /bodies/:id/my_permissions')).toHaveLength(0);
    });
});

test.describe('joining and leaving a body', () => {
    test('a member of another body asks to join with a motivation', async ({ page, api }) => {
        answer(api, bodyDetail({ id: 5, email: 'elsewhere@example.com', website: 'https://elsewhere.example.org' }));
        api.json('POST core /bodies/:id/join-requests', ok({ id: 1, body_id: 5, user_id: 2, motivation: 'I like it', status: 'pending' }));

        await page.goto('/bodies/5');
        await page.getByRole('button', { name: 'Ask to join body' }).click();

        const prompt = dialog(page, 'Join body');
        await expect(prompt).toContainText('we strongly encourage you to also contact the Local board directly by email');
        await expect(prompt).toContainText('Local email: elsewhere@example.com');
        await expect(prompt).toContainText('Website: https://elsewhere.example.org');
        await prompt.getByRole('textbox', { name: 'Motivation' }).fill('I like it');
        await prompt.getByRole('button', { name: 'OK' }).click();

        await expect(toast(page, 'Join request is sent.')).toBeVisible();
        await expect(page.getByText('Join request sent')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Ask to join body' })).toHaveCount(0);
        await expect.poll(() => api.callsTo('POST core /bodies/:id/join-requests').map((call) => [call.params, call.body])).toEqual([[{ id: '5' }, { motivation: 'I like it' }]]);
    });

    test('the join message leaves out a missing website', async ({ page, api }) => {
        answer(api, bodyDetail({ id: 5, email: 'elsewhere@example.com', website: null }));

        await page.goto('/bodies/5');
        await page.getByRole('button', { name: 'Ask to join body' }).click();

        const prompt = dialog(page, 'Join body');
        await expect(prompt).toContainText('Local email: elsewhere@example.com');
        await expect(prompt).not.toContainText('Website:');
        await prompt.getByRole('button', { name: 'Cancel' }).click();
        await expect(prompt).toBeHidden();
    });

    test('shows that the member asked already', async ({ page, api, me }) => {
        me!.join_requests = [{ id: 1, body_id: 5, user_id: 2, status: 'pending', motivation: 'x' }];
        answer(api, bodyDetail({ id: 5 }));

        await page.goto('/bodies/5');

        await expect(page.getByText('Join request sent')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Ask to join body' })).toHaveCount(0);
    });

    test('says when the member asked already', async ({ page, api }) => {
        answer(api, bodyDetail({ id: 5 }));
        api.on('POST core /bodies/:id/join-requests', { status: 422, json: validationError({ body_id: ['This user already has a join request for this body.'] }) });

        await page.goto('/bodies/5');
        await page.getByRole('button', { name: 'Ask to join body' }).click();
        await dialog(page, 'Join body').getByRole('button', { name: 'OK' }).click();

        await expect(toast(page, 'You\'ve already requested to join this body.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Ask to join body' })).toBeVisible();
        await expect.poll(() => api.callsTo('POST core /bodies/:id/join-requests')[0].body).toEqual({ motivation: '' });
    });

    test('says why the join request was not sent', async ({ page, api }) => {
        answer(api, bodyDetail({ id: 5 }));
        api.on('POST core /bodies/:id/join-requests', { status: 500, json: { success: false, message: 'Database is down' } });

        await page.goto('/bodies/5');
        await page.getByRole('button', { name: 'Ask to join body' }).click();
        await dialog(page, 'Join body').getByRole('button', { name: 'OK' }).click();

        await expect(toast(page, 'Could not send join request: Database is down')).toBeVisible();
    });

    test('a member leaves the body after confirming', async ({ page, api }) => {
        answer(api, bodyDetail({ id: 1 }));
        api.json('DELETE core /bodies/:id/members', ok({}));

        await page.goto('/bodies/1');
        await page.getByRole('button', { name: 'Leave body' }).click();
        const confirm = dialog(page, 'Leaving a body');
        await expect(confirm).toContainText('Are you sure you want to leave this body? You will probably not be able to join later.');
        await confirm.getByRole('button', { name: 'Cancel' }).click();
        await expect(confirm).toBeHidden();
        expect(api.callsTo('DELETE core /bodies/:id/members')).toHaveLength(0);

        await page.getByRole('button', { name: 'Leave body' }).click();
        await dialog(page, 'Leaving a body').getByRole('button', { name: 'Leave body' }).click();

        await expect(toast(page, 'You are not the member anymore.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Ask to join body' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Leave body' })).toHaveCount(0);
        await expect.poll(() => api.callsTo('DELETE core /bodies/:id/members').map((call) => call.params)).toEqual([{ id: '1' }]);
    });

    test('says why leaving failed', async ({ page, api }) => {
        answer(api, bodyDetail({ id: 1 }));
        api.on('DELETE core /bodies/:id/members', { status: 500, json: { success: false, message: 'Database is down' } });

        await page.goto('/bodies/1');
        await page.getByRole('button', { name: 'Leave body' }).click();
        await dialog(page, 'Leaving a body').getByRole('button', { name: 'Leave body' }).click();

        await expect(toast(page, 'Could not leave body: Database is down')).toBeVisible();
        await expect(dialog(page, 'Leaving a body')).toBeHidden();
        await expect(page.getByRole('button', { name: 'Leave body' })).toBeVisible();
    });
});

test.describe('deleting and restoring a body', () => {
    test('deletes an active body after confirming', async ({ page, api }) => {
        answer(api, bodyDetail({ id: 1, status: 'active' }), { permissions: ['global:delete:body'] });
        api.json('PUT core /bodies/:id/status', ok({}));

        await page.goto('/bodies/1');
        await page.getByRole('button', { name: 'Delete body' }).click();
        const confirm = dialog(page, 'Deleting a body');
        await expect(confirm).toContainText('Are you sure you want to delete this body? This action cannot be undone.');
        await confirm.getByRole('button', { name: 'Cancel' }).click();
        await expect(confirm).toBeHidden();
        expect(api.callsTo('PUT core /bodies/:id/status')).toHaveLength(0);

        await page.getByRole('button', { name: 'Delete body' }).click();
        await dialog(page, 'Deleting a body').getByRole('button', { name: 'Delete body' }).click();

        await expect(toast(page, 'Body is deleted.')).toBeVisible();
        await expect(dialog(page, 'Deleting a body')).toBeHidden();
        await expect(page.getByRole('button', { name: 'Restore body' })).toBeVisible();
        await expect.poll(() => api.callsTo('PUT core /bodies/:id/status').map((call) => [call.params, call.body])).toEqual([[{ id: '1' }, { status: 'deleted' }]]);
    });

    test('restores a deleted body', async ({ page, api }) => {
        answer(api, bodyDetail({ id: 1, status: 'deleted' }), { permissions: ['global:delete:body'] });
        api.json('PUT core /bodies/:id/status', ok({}));

        await page.goto('/bodies/1');
        await page.getByRole('button', { name: 'Restore body' }).click();
        const confirm = dialog(page, 'Restoring a body');
        await expect(confirm).toContainText('Are you sure you want to restore this body?');
        await confirm.getByRole('button', { name: 'Restore body' }).click();

        await expect(toast(page, 'Body is restored.')).toBeVisible();
        await expect(dialog(page, 'Restoring a body')).toBeHidden();
        await expect(page.getByRole('button', { name: 'Delete body' })).toBeVisible();
        await expect.poll(() => api.callsTo('PUT core /bodies/:id/status')[0].body).toEqual({ status: 'active' });
    });

    test('says why the status could not be changed', async ({ page, api }) => {
        answer(api, bodyDetail({ id: 1, status: 'active' }), { permissions: ['global:delete:body'] });
        api.on('PUT core /bodies/:id/status', { status: 403, json: forbidden('Permission global:delete:body is required, but not present.') });

        await page.goto('/bodies/1');
        await page.getByRole('button', { name: 'Delete body' }).click();
        await dialog(page, 'Deleting a body').getByRole('button', { name: 'Delete body' }).click();

        await expect(toast(page, 'Could not change body status: Permission global:delete:body is required, but not present.')).toBeVisible();
        await expect(dialog(page, 'Deleting a body')).toBeHidden();
        await expect(page.getByRole('button', { name: 'Delete body' })).toBeVisible();
    });
});

test.describe('adding to a body from its page', () => {
    test('adds a member and shows the page again', async ({ page, api }) => {
        answer(api, bodyDetail({ id: 1 }), { permissions: BOARD });
        api.json('GET core /members_search', ok([memberSearchResult({ id: 55, first_name: 'Jane', last_name: 'Doe' })]));
        api.json('POST core /bodies/:id/members', ok({ id: 90, user_id: 55, body_id: 1 }));

        await page.goto('/bodies/1');
        await page.getByRole('button', { name: 'Add member' }).click();
        const modal = dialog(page, 'Add member');
        await modal.getByRole('textbox', { name: 'Search by name or email' }).fill('jan');
        await modal.getByRole('button', { name: 'Jane Doe' }).click();

        await expect.poll(() => api.callsTo('GET core /bodies/:id').length).toBe(2);
        await expect(toast(page, 'Could not add member')).toHaveCount(0);
        await expect.poll(() => api.callsTo('GET core /members_search')[0].query.get('query')).toBe('jan');
        await expect.poll(() => api.callsTo('POST core /bodies/:id/members').map((call) => [call.params, call.body])).toEqual([[{ id: '1' }, { user_id: 55 }]]);
    });

    test('adds a bound circle and lists it', async ({ page, api }) => {
        answer(api, bodyDetail({ id: 1, circles: [] }), { permissions: BOARD });
        api.on('POST core /bodies/:id/circles', { json: ok(circle({ id: 63, body_id: 1, name: 'Fundraising team', description: 'Finds sponsors' })), delayMs: 500 });

        await page.goto('/bodies/1');
        await page.getByRole('button', { name: 'Add bound circle' }).click();
        const modal = dialog(page, 'Add circle');
        await modal.getByLabel('Name').fill('Fundraising team');
        await modal.getByLabel('Description').fill('Finds sponsors');
        await modal.getByRole('button', { name: 'Save changes' }).click();

        await expect(modal.getByRole('button', { name: 'Save changes' })).toBeDisabled();
        await expect(toast(page, 'Bound circle is created.')).toBeVisible();
        await expect(modal).toBeHidden();
        await expect(page.getByRole('link', { name: 'Fundraising team' })).toHaveAttribute('href', '/circles/63');
        await expect.poll(() => api.callsTo('POST core /bodies/:id/circles').map((call) => [call.params, call.body])).toEqual([[{ id: '1' }, { name: 'Fundraising team', description: 'Finds sponsors' }]]);
    });

    test('shows what is wrong with a bound circle', async ({ page, api }) => {
        answer(api, bodyDetail({ id: 1 }), { permissions: BOARD });
        api.on('POST core /bodies/:id/circles', { status: 422, json: validationError({ name: ['Name should be set.'], description: ['Description should be set.'] }) });

        await page.goto('/bodies/1');
        await page.getByRole('button', { name: 'Add bound circle' }).click();
        const modal = dialog(page, 'Add circle');
        await modal.getByRole('button', { name: 'Save changes' }).click();

        await expect(toast(page, 'Some fields were not set')).toBeVisible();
        await expect(modal.getByText('Name should be set.')).toBeVisible();
        await expect(modal.getByText('Description should be set.')).toBeVisible();
        await expect(modal.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    });

    test('says why the bound circle was not added, and closes without adding', async ({ page, api }) => {
        answer(api, bodyDetail({ id: 1 }), { permissions: BOARD });
        api.on('POST core /bodies/:id/circles', { status: 403, json: forbidden('Permission create:circle is required, but not present.') });

        await page.goto('/bodies/1');
        await page.getByRole('button', { name: 'Add bound circle' }).click();
        const modal = dialog(page, 'Add circle');
        await modal.getByLabel('Name').fill('Fundraising team');
        await modal.getByRole('button', { name: 'Save changes' }).click();

        await expect(toast(page, 'Some error happened: Permission create:circle is required, but not present.')).toBeVisible();
        await modal.getByRole('button', { name: 'Cancel' }).click();
        await expect(modal).toBeHidden();
        await page.getByRole('button', { name: 'Add bound circle' }).click();
        await dialog(page, 'Add circle').getByRole('button', { name: 'close' }).click();
        await expect(dialog(page, 'Add circle')).toBeHidden();
        await expect.poll(() => api.callsTo('POST core /bodies/:id/circles')).toHaveLength(1);
    });
});

test.describe('adding a board from the body page', () => {
    const PEOPLE = [membership(41, 'Pia', 'President'), membership(42, 'Sam', 'Secretary'), membership(43, 'Tom', 'Treasurer'), membership(44, 'Val', 'Vice')];
    const antenna = () => bodyDetail({ id: 1, type: 'antenna', email: 'antenna@example.com', phone: '+32 2 000 00 00', address: 'Main street 1', postal_address: null, website: null });

    // The people of the body whose name starts with what was typed.
    const searchPeople = (api: ApiMock): void => {
        api.on('GET core /bodies/:id/members', ({ query }) => ({
            json: ok(PEOPLE.filter((person) => person.user.first_name.startsWith(query.get('query') ?? '')))
        }));
    };

    const pick = async (page: Page, position: string, typed: string, name: string): Promise<void> => {
        const group = dialog(page, 'Add board').getByRole('group', { name: position });
        await group.getByRole('textbox').last().fill(typed);
        await dialog(page, 'Add board').getByRole('button', { name }).click();
    };

    test('a board member adds the new board with its people and the contact details', async ({ page, api }) => {
        answer(api, antenna(), { permissions: ['local:manage_network:boards'] });
        searchPeople(api);
        api.json('PUT core /bodies/:id', ok({}));
        api.json('POST network /bodies/:id/boards', ok(board({ body_id: 1 })));

        await page.goto('/bodies/1');
        await page.getByRole('button', { name: 'Change board' }).click();
        const modal = dialog(page, 'Add board');
        await fillDate(modal.getByLabel('Board election date'), '2026-12-01');
        await fillDate(modal.getByLabel('Term start date'), '2027-01-01');
        await fillDate(modal.getByLabel('Term end date'), '2027-12-31');
        await modal.getByLabel('Board name').fill('Board 2027');
        await pick(page, 'President', 'Pia', 'Pia President');
        await pick(page, 'Secretary', 'Sam', 'Sam Secretary');
        await pick(page, 'Treasurer', 'Tom', 'Tom Treasurer');
        await modal.getByRole('button', { name: 'Add new position' }).click();
        // The first box of a new position is its function, the second the person.
        await modal.getByRole('group', { name: 'New position' }).getByRole('textbox').first().fill('Vice-president');
        await pick(page, 'Vice-president', 'Val', 'Val Vice');
        await expect(modal.getByLabel('Email')).toHaveValue('antenna@example.com');
        await modal.getByLabel('Phone').fill('+32 2 111 11 11');
        await modal.getByRole('textbox', { name: 'Message' }).fill('We are **the** new board');
        await expect(modal.getByRole('region', { name: 'Preview of the message' }).getByText('the', { exact: true })).toHaveJSProperty('tagName', 'STRONG');
        await modal.getByRole('button', { name: 'Save changes' }).click();

        // The page is loaded again to show the new board.
        await expect.poll(() => api.callsTo('GET core /bodies/:id').length).toBe(2);
        // Picking a person searches once more for the whole name (the box shows it after the pick).
        await expect.poll(() => api.callsTo('GET core /bodies/:id/members').map((call) => call.query.get('query'))).toEqual(expect.arrayContaining(['Pia', 'Sam', 'Tom', 'Val']));
        const [details] = api.callsTo('PUT core /bodies/:id');
        expect(details.params).toEqual({ id: '1' });
        expect(details.body).toMatchObject({ email: 'antenna@example.com', phone: '+32 2 111 11 11', address: 'Main street 1' });
        await expect.poll(() => api.callsTo('POST network /bodies/:id/boards').map((call) => [call.params, call.body])).toEqual([[{ id: '1' }, {
            body_id: 1,
            elected_date: '2026-12-01',
            start_date: '2027-01-01',
            end_date: '2027-12-31',
            president: 41,
            secretary: 42,
            treasurer: 43,
            other_members: [{ function: 'Vice-president', user_id: 44 }],
            name: 'Board 2027',
            message: 'We are **the** new board'
        }]]);
    });

    test('a position added by mistake can be removed', async ({ page, api }) => {
        answer(api, antenna(), { permissions: ['local:manage_network:boards'] });
        api.json('PUT core /bodies/:id', ok({}));
        api.on('POST network /bodies/:id/boards', { status: 403, json: forbidden('You are not allowed to manage the boards of this body.') });

        await page.goto('/bodies/1');
        await page.getByRole('button', { name: 'Change board' }).click();
        const modal = dialog(page, 'Add board');
        await modal.getByRole('button', { name: 'Add new position' }).click();
        await expect(modal.getByRole('group', { name: 'New position' })).toBeVisible();
        await modal.getByRole('button', { name: 'Remove the position New position' }).click();
        await expect(modal.getByRole('group', { name: 'New position' })).toHaveCount(0);
        await modal.getByRole('button', { name: 'Save changes' }).click();

        await expect(toast(page, 'Something went wrong: You are not allowed to manage the boards of this body.')).toBeVisible();
        await expect.poll(() => api.callsTo('POST network /bodies/:id/boards')[0].body).toMatchObject({ other_members: [] });
    });

    test('says why the people could not be searched', async ({ page, api }) => {
        answer(api, antenna(), { permissions: ['local:manage_network:boards'] });
        api.on('GET core /bodies/:id/members', { status: 500, json: { success: false, message: 'Database is down' } });

        await page.goto('/bodies/1');
        await page.getByRole('button', { name: 'Change board' }).click();
        await dialog(page, 'Add board').getByRole('group', { name: 'President' }).getByRole('textbox').fill('Pia');

        await expect(toast(page, 'Could not fetch members: Database is down')).toBeVisible();
        await dialog(page, 'Add board').getByRole('button', { name: 'Cancel' }).click();
        await expect(dialog(page, 'Add board')).toBeHidden();
    });
});
