const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const regularUser = require('../assets/core-valid.json').data;

describe('Massmailer', () => {
    let event;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();

        event = await generator.createEvent();
        await generator.createApplication({
            user_id: 1,
            body_id: regularUser.bodies[0].id,
            participant_type: 'envoy',
            participant_order: 1,
            status: 'accepted'
        }, event);
        await generator.createApplication({
            user_id: 2,
            body_id: regularUser.bodies[0].id,
            participant_type: 'envoy',
            participant_order: 2,
            status: 'rejected'
        }, event);
        await generator.createApplication({
            user_id: 3,
            body_id: regularUser.bodies[0].id,
            participant_type: 'envoy',
            participant_order: 3
        }, event);
        await generator.createApplication({
            user_id: 4,
            body_id: regularUser.bodies[0].id,
            participant_type: 'envoy',
            participant_order: 4,
            cancelled: true
        }, event);
    });

    afterEach(async () => {
        await generator.clearAll();
        mock.cleanAll();
    });

    test('should disallow using massmailer if no rights', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const res = await request({
            path: '/events/' + event.id + '/massmailer',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                subject: 'Testing',
                text: 'Testing mail sending.'
            }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should send mass mail if everything is okay', async () => {
        const res = await request({
            path: '/events/' + event.id + '/massmailer',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                subject: 'Testing',
                text: 'Testing mail sending.'
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('message');
        expect(res.body.meta.sent).toEqual(3);
    });

    test('should work okay if the pax type/order is not set', async () => {
        await generator.createApplication({
            user_id: 5,
            body_id: regularUser.bodies[0].id,
            participant_type: null,
            participant_order: null,
            status: 'accepted'
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/massmailer',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                subject: 'Testing',
                text: 'Testing mail sending.'
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('message');
        expect(res.body.meta.sent).toEqual(4);
    });

    test('should fail if body is not set', async () => {
        const res = await request({
            path: '/events/' + event.id + '/massmailer',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                subject: 'Testing'
            }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if body is empty', async () => {
        const res = await request({
            path: '/events/' + event.id + '/massmailer',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                text: '',
                subject: 'Testing'
            }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if subject is not set', async () => {
        const res = await request({
            path: '/events/' + event.id + '/massmailer',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                text: 'Testing'
            }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if subject is empty', async () => {
        const res = await request({
            path: '/events/' + event.id + '/massmailer',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                text: 'Text',
                subject: ''
            }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if mailer returns net error', async () => {
        mock.mockAll({ mailer: { netError: true } });
        const res = await request({
            path: '/events/' + event.id + '/massmailer',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                subject: 'Testing',
                text: 'Testing mail sending.'
            }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if mailer returns bad response', async () => {
        mock.mockAll({ mailer: { badResponse: true } });
        const res = await request({
            path: '/events/' + event.id + '/massmailer',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                subject: 'Testing',
                text: 'Testing mail sending.'
            }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if mailer returns unsuccessful response', async () => {
        mock.mockAll({ mailer: { unsuccessfulResponse: true } });
        const res = await request({
            path: '/events/' + event.id + '/massmailer',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                subject: 'Testing',
                text: 'Testing mail sending.'
            }
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should work with filtering', async () => {
        const res = await request({
            path: '/events/' + event.id + '/massmailer/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                subject: 'Testing',
                text: 'Testing mail sending.',
                filter: { status: 'accepted' }
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('message');
        expect(res.body.meta.sent).toEqual(1);
    });

    test('should work with all the fields the filter supports', async () => {
        const res = await request({
            path: '/events/' + event.id + '/massmailer/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                subject: 'Testing',
                text: 'Testing mail sending.',
                filter: {
                    status: 'accepted',
                    cancelled: false,
                    confirmed: false,
                    incoming: false,
                    participant_type: 'envoy'
                }
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.meta.sent).toEqual(1);
    });

    test('should fail if the filter has a field other than the supported ones', async () => {
        const otherEvent = await generator.createEvent({ applications: [] });
        await generator.createApplication({ user_id: 1, body_id: regularUser.bodies[0].id }, otherEvent);
        await generator.createApplication({ user_id: 2, body_id: regularUser.bodies[0].id }, otherEvent);

        const res = await request({
            path: '/events/' + event.id + '/massmailer/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                subject: 'Testing',
                text: 'Testing mail sending.',
                filter: { event_id: otherEvent.id }
            }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body.message).toMatch(/^Filtering by this field is not supported\./);
        expect(res.body.message).not.toMatch(/event_id/);
    });

    test('should fail if a filter value is not a plain value or a list of them', async () => {
        const res = await request({
            path: '/events/' + event.id + '/massmailer/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                subject: 'Testing',
                text: 'Testing mail sending.',
                filter: { status: { accepted: true } }
            }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body.message).toMatch(/status/);
    });

    test.each([
        ['an unknown status', { status: 'unknown' }],
        ['an empty status', { status: '' }],
        ['a flag that is not a boolean', { confirmed: 'maybe' }],
        ['an unknown participant type', { participant_type: 'chair' }],
        ['a list with an unknown status', { status: ['accepted', 'unknown'] }]
    ])('should fail if the filter has %s', async (name, filter) => {
        const res = await request({
            path: '/events/' + event.id + '/massmailer/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                subject: 'Testing',
                text: 'Testing mail sending.',
                filter
            }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body.message).toMatch(new RegExp(Object.keys(filter)[0]));
    });

    test('should accept a list of values in the filter', async () => {
        const res = await request({
            path: '/events/' + event.id + '/massmailer/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                subject: 'Testing',
                text: 'Testing mail sending.',
                filter: { status: ['accepted', 'rejected'] }
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.meta.sent).toEqual(2);
    });

    test('should fail if no users match the filter', async () => {
        const res = await request({
            path: '/events/' + event.id + '/massmailer/',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                subject: 'Testing',
                text: 'Testing mail sending.',
                filter: { status: 'accepted', confirmed: true }
            }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should not fail if one user does not exist', async () => {
        await generator.createApplication({
            user_id: 7
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/massmailer',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                subject: 'Testing',
                text: 'Testing mail sending.'
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('message');
        expect(res.body.meta.sent).toEqual(3);
    });

    test.each([0, 'all', [], true, null])('should answer 400 for the filter %j and send nothing', async (filter) => {
        const { mailerStub } = mock.mockAll();

        const res = await request({
            path: '/events/' + event.id + '/massmailer',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { subject: 'Testing', text: 'Testing mail sending.', filter }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body).toEqual({ success: false, message: 'The filter should be an object.' });
        expect(mailerStub.isDone()).toEqual(false);
    });

    test.each([0, ['a@example.org'], true, null])('should answer 400 for the reply-to address %j and send nothing', async (replyTo) => {
        const { mailerStub } = mock.mockAll();

        const res = await request({
            path: '/events/' + event.id + '/massmailer',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { subject: 'Testing', text: 'Testing mail sending.', reply_to: replyTo }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body).toEqual({ success: false, message: 'The reply-to address should be a text.' });
        expect(mailerStub.isDone()).toEqual(false);
    });

    describe('who may send and what is sent', () => {
        const send = (targetEvent, body) => request({
            path: '/events/' + targetEvent.id + '/massmailer',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body
        });

        // The mails the mailer was asked to send.
        const mailsOf = (stubs) => {
            const mails = [];
            stubs.mailerStub.on('request', (req, interceptor, body) => mails.push(JSON.parse(body)));
            return mails;
        };

        test.each(['agora', 'epm', 'spm'])('lets a holder of global:use_massmailer:%s alone mail the applicants of such an event', async (type) => {
            const stubs = mock.mockAll({ mainPermissions: { permissions: [`global:use_massmailer:${type}`] } });
            const mails = mailsOf(stubs);
            const typedEvent = await generator.createEvent({ type });
            await generator.createApplication({ user_id: 1, body_id: regularUser.bodies[0].id }, typedEvent);

            const res = await send(typedEvent, { subject: 'Testing', text: 'Testing mail sending.' });

            expect(res.statusCode).toEqual(200);
            expect(res.body).toEqual({ success: true, message: 'Mail was sent successfully.', meta: { sent: 1 } });
            expect(mails.length).toEqual(1);
        });

        test.each([
            ['agora', ['global:use_massmailer:epm', 'global:use_massmailer:spm']],
            ['epm', ['global:use_massmailer:agora', 'global:use_massmailer:spm']],
            ['spm', ['global:use_massmailer:agora', 'global:use_massmailer:epm']]
        ])('refuses the applicants of an %s event to a holder of the permission for the other event types', async (type, permissions) => {
            const stubs = mock.mockAll({
                mainPermissions: { permissions: [...permissions, `global:manage_applications:${type}`, `global:manage_event:${type}`] }
            });
            const mails = mailsOf(stubs);
            const typedEvent = await generator.createEvent({ type });
            await generator.createApplication({ user_id: 1, body_id: regularUser.bodies[0].id }, typedEvent);

            const res = await send(typedEvent, { subject: 'Testing', text: 'Testing mail sending.' });

            expect(res.statusCode).toEqual(403);
            expect(res.body).toEqual({ success: false, message: 'You cannot access massmailer.' });
            expect(mails).toEqual([]);
        });

        test('sends each applicant of this event who did not cancel one mail with their own values filled in', async () => {
            const stubs = mock.mockAll({ mainPermissions: { permissions: ['global:use_massmailer:agora'] } });
            const mails = mailsOf(stubs);

            const agora = await generator.createEvent({ type: 'agora' });
            const delegate = await generator.createApplication({
                user_id: 1,
                body_id: regularUser.bodies[0].id,
                first_name: 'Ada',
                last_name: 'Example',
                body_name: 'AEGEE-Alicante',
                participant_type: 'delegate',
                participant_order: 2
            }, agora);
            const visitor = await generator.createApplication({
                user_id: 2,
                body_id: regularUser.bodies[0].id,
                first_name: 'Ben',
                last_name: 'Sample',
                body_name: 'AEGEE-Bergamo',
                participant_type: null,
                participant_order: null
            }, agora);
            // Cancelled, so not mailed.
            await generator.createApplication({ user_id: 3, body_id: regularUser.bodies[0].id, cancelled: true }, agora);
            // An applicant of another event, so not mailed.
            const otherAgora = await generator.createEvent({ type: 'agora' });
            await generator.createApplication({ user_id: 4, body_id: regularUser.bodies[0].id }, otherAgora);

            const res = await send(agora, {
                subject: 'Your place',
                reply_to: 'chair@example.org',
                text: 'Dear {first_name} {LAST_NAME} of {body_name}, you are {participant_type_order} ({statutory_id}). Bye {first_name}.'
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.meta).toEqual({ sent: 2 });

            expect(mails.length).toEqual(1);
            const [mail] = mails;
            expect(mail.subject).toEqual('Your place');
            expect(mail.reply_to).toEqual('chair@example.org');
            expect(mail.template).toEqual('custom.html');

            // One address and one text per applicant, at the same place in both lists.
            const sent = Object.fromEntries(mail.to.map((address, index) => [address, mail.parameters[index].email_body]));
            expect(sent).toEqual({
                'admin@example.com': `Dear Ada Example of AEGEE-Alicante, you are delegate (2) (${delegate.statutory_id}). Bye Ada.`,
                'test@example.com': `Dear Ben Sample of AEGEE-Bergamo, you are not set (${visitor.statutory_id}). Bye Ben.`
            });
        });

        test('mails the applicants who cancelled only when the filter asks for them', async () => {
            const stubs = mock.mockAll({ mainPermissions: { permissions: ['global:use_massmailer:agora'] } });
            const mails = mailsOf(stubs);

            const agora = await generator.createEvent({ type: 'agora' });
            await generator.createApplication({ user_id: 1, body_id: regularUser.bodies[0].id }, agora);
            await generator.createApplication({ user_id: 3, body_id: regularUser.bodies[0].id, cancelled: true }, agora);

            const res = await send(agora, { subject: 'Testing', text: 'Testing mail sending.', filter: { cancelled: true } });

            expect(res.statusCode).toEqual(200);
            expect(res.body.meta).toEqual({ sent: 1 });
            expect(mails[0].to).toEqual(['example@example.com']);
        });

        test.each([
            ['a text of spaces only', { subject: 'Testing', text: '   ' }, 'Please provide an email body.'],
            ['a text that is not a string', { subject: 'Testing', text: 42 }, 'Please provide an email body.'],
            ['a subject of spaces only', { subject: '   ', text: 'Testing mail sending.' }, 'Please provide an email subject.'],
            ['a subject that is not a string', { subject: ['Testing'], text: 'Testing mail sending.' }, 'Please provide an email subject.']
        ])('answers 400 for %s and sends nothing', async (description, body, message) => {
            const stubs = mock.mockAll({ mainPermissions: { permissions: ['global:use_massmailer:agora'] } });
            const mails = mailsOf(stubs);

            const agora = await generator.createEvent({ type: 'agora' });
            await generator.createApplication({ user_id: 1, body_id: regularUser.bodies[0].id }, agora);

            const res = await send(agora, body);

            expect(res.statusCode).toEqual(400);
            expect(res.body).toEqual({ success: false, message });
            expect(mails).toEqual([]);
        });
    });
});
