const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const mailer = require('../../lib/mailer');
const regularUser = require('../assets/core-valid.json').data;
const { Event, Application, MembersList } = require('../../models');

const UNREADABLE = { success: false, message: 'The request body could not be read.' };
const NOT_STORABLE = { success: false, message: 'The request body contains characters that cannot be stored.' };
const NOT_AN_OBJECT = { success: false, message: 'The body should be an object.' };

// A body that cannot be read, holds characters that the database cannot store, or is no
// object where the route takes one, is refused before the route runs: nothing is stored
// and no mail is sent.
describe('Request bodies', () => {
    let event;
    let application;
    let sendMail;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();
        sendMail = jest.spyOn(mailer, 'sendMail');
        event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate(),
            applications: []
        });
        application = await generator.createApplication({ user_id: regularUser.id, body_id: regularUser.bodies[0].id }, event);
    });

    afterEach(async () => {
        jest.restoreAllMocks();
        await generator.clearAll();
        mock.cleanAll();
    });

    const snapshot = async () => ({
        events: (await Event.findAll({ order: [['id', 'ASC']], raw: true })).map((row) => ({ ...row, updated_at: null })),
        applications: (await Application.findAll({ order: [['id', 'ASC']], raw: true })).map((row) => ({ ...row, updated_at: null })),
        memberslists: await MembersList.count()
    });

    // A route of each router that takes an object as its body.
    const writeRoutes = () => [
        ['POST', '/'],
        ['PUT', `/events/${event.id}`],
        ['PUT', `/events/${event.id}/status`],
        ['POST', `/events/${event.id}/applications`],
        ['PUT', `/events/${event.id}/applications/me`],
        ['PUT', `/events/${event.id}/applications/${application.id}/confirmed`],
        ['PUT', `/events/${event.id}/applications/${application.id}/status`],
        ['PUT', `/events/${event.id}/applications/${application.id}/board`],
        ['POST', `/events/${event.id}/memberslists/${regularUser.bodies[0].id}`],
        ['POST', `/events/${event.id}/massmailer`],
        ['POST', '/limits/agora'],
        ['POST', `/events/${event.id}/positions`],
        ['POST', `/events/${event.id}/plenaries`],
        ['POST', `/events/${event.id}/question-lines`]
    ];

    describe('a body that is no object', () => {
        test.each([
            ['null', null],
            ['a number', 1],
            ['a text', 'text'],
            ['a list', [{ name: 'A name' }]],
            ['true', true]
        ])('%s answers 400 on every route that takes an object', async (description, body) => {
            const before = await snapshot();

            for (const [method, path] of writeRoutes()) {
                const res = await request({ path, method, headers: { 'X-Auth-Token': 'blablabla' }, body });

                expect({ method, path, status: res.statusCode, body: res.body }).toEqual({ method, path, status: 400, body: NOT_AN_OBJECT });
            }

            expect(await snapshot()).toEqual(before);
            expect(sendMail).not.toHaveBeenCalled();
        });

        test('a list is the body of the board view of a body', async () => {
            const res = await request({
                path: `/events/${event.id}/applications/boardview/${regularUser.bodies[0].id}`,
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: []
            });

            expect(res.statusCode).toEqual(200);
        });

        test.each([null, 1, 'text', { user_id: 1 }])('the board view of a body answers 400 for %j', async (body) => {
            const res = await request({
                path: `/events/${event.id}/applications/boardview/${regularUser.bodies[0].id}`,
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body
            });

            expect(res.statusCode).toEqual(400);
            expect(res.body).toEqual({ success: false, message: 'The body is not an array.' });
        });
    });

    describe('characters that cannot be stored', () => {
        test.each([
            ['a NUL character in a text', { name: 'a\u0000b' }],
            ['a NUL character in a list', { locations: [{ name: 'a\u0000b', position: { lat: 1, lng: 1 } }] }],
            ['a NUL character in an object in a list', { questions: [{ type: 'string', description: 'a\u0000b', required: true }] }],
            ['a NUL character in a key', { 'a\u0000b': 'value' }],
            ['an unpaired surrogate', { name: 'a\ud800b' }],
            ['an unpaired low surrogate', { description: 'a\udc00b' }]
        ])('%s answers 400', async (description, fields) => {
            const before = await snapshot();

            for (const [method, path] of writeRoutes()) {
                const res = await request({ path, method, headers: { 'X-Auth-Token': 'blablabla' }, body: fields });

                expect({ method, path, status: res.statusCode, body: res.body }).toEqual({ method, path, status: 400, body: NOT_STORABLE });
            }

            expect(await snapshot()).toEqual(before);
            expect(sendMail).not.toHaveBeenCalled();
        });

        test('a character outside the basic plane is stored', async () => {
            const res = await request({
                path: `/events/${event.id}`,
                method: 'PUT',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: { name: 'An Agora 🎉' }
            });

            expect(res.statusCode).toEqual(200);
            expect((await Event.findByPk(event.id)).name).toEqual('An Agora 🎉');
        });
    });

    describe('a body that cannot be read', () => {
        const put = (options) => request({
            path: `/events/${event.id}`,
            method: 'PUT',
            ...options,
            headers: { 'X-Auth-Token': 'blablabla', ...options.headers }
        });

        test.each([
            ['larger than 1 MB', 413, { rawBody: JSON.stringify({ description: 'x'.repeat(1024 * 1024) }) }],
            ['in a charset that is not supported', 415, { rawBody: '{}', headers: { 'Content-Type': 'application/json; charset=bogus<b>' } }],
            ['in an encoding that is not supported', 415, { rawBody: '{}', headers: { 'Content-Encoding': 'bogus<b>' } }],
            ['said to be gzip, but not', 400, { rawBody: '{}', headers: { 'Content-Encoding': 'gzip' } }],
            ['nested 10,000 levels deep', 400, { rawBody: '{"name":' + '['.repeat(10000) + ']'.repeat(10000) + '}' }],
            ['nested 10,000 levels deep with a NUL character at the bottom', 400, { rawBody: '{"name":' + '['.repeat(10000) + '"a\\u0000b"' + ']'.repeat(10000) + '}' }],
            ['nested 10,000 levels deep in objects', 400, { rawBody: '{"a":'.repeat(10000) + '1' + '}'.repeat(10000) }]
        ])('%s answers %i', async (description, status, options) => {
            const before = await snapshot();

            const res = await put(options);

            expect(res.statusCode).toEqual(status);
            expect(res.body).toEqual(UNREADABLE);
            expect(await snapshot()).toEqual(before);
        });

        test('text that is not JSON answers 400', async () => {
            const res = await put({ rawBody: '{"name": ' });

            expect(res.statusCode).toEqual(400);
            expect(res.body).toEqual({ success: false, message: 'Invalid JSON.' });
        });

        test('a members list of 2,000 members is read', async () => {
            const members = Array.from({ length: 2000 }, () => generator.generateMembersListMember());

            const res = await request({
                path: `/events/${event.id}/memberslists/${regularUser.bodies[0].id}`,
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: generator.generateMembersList({ members })
            });

            expect(res.statusCode).toEqual(200);
            expect((await MembersList.findOne()).members.length).toEqual(2000);
        });
    });

    describe('a path that cannot be read', () => {
        test.each(['/events/%E0%A4%A', '/events/%ED%A0%80', '/limits/agora/%E0'])('%s answers 400', async (path) => {
            const res = await request({ path, method: 'GET', headers: { 'X-Auth-Token': 'blablabla' } });

            expect(res.statusCode).toEqual(400);
            expect(res.body).toEqual({ success: false, message: 'The path could not be read.' });
        });
    });
});
