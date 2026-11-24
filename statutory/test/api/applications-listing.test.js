const moment = require('moment');
const tk = require('timekeeper');

const { startServer, stopServer } = require('../../lib/server');
const constants = require('../../lib/constants');

const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { Application } = require('../../models');

describe('Applications listing', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();
    });

    afterEach(async () => {
        tk.reset();
        await generator.clearAll();
        mock.cleanAll();
    });

    test('should display everything if the user has permissions on /all', async () => {
        const event = await generator.createEvent();

        const res = await request({
            path: '/events/' + event.id + '/applications/all',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        const applicationIds = event.applications.map((a) => a.id);
        expect(res.body.data.length).toEqual(applicationIds.length);

        for (const application of res.body.data) {
            expect(applicationIds).toContain(application.id);
        }
    });

    test('should result in an error if user does not have permission on /all', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
        const event = await generator.createEvent();

        const res = await request({
            path: '/events/' + event.id + '/applications/all',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 403 if no rights and before the deadline on /accepted', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
        const event = await generator.createEvent();
        await generator.createApplication({ status: 'pending' }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/accepted',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should display accepted application on /accepted', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
        const event = await generator.createEvent();
        const application = await generator.createApplication({ status: 'accepted' }, event);

        tk.travel(moment(event.participants_list_publish_deadline).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/accepted',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        tk.reset();

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(application.id);

        expect(Object.keys(res.body.data[0]).length).toEqual(constants.ALLOWED_PARTICIPANTS_LIST_FIELDS.length);
        for (const field of constants.ALLOWED_PARTICIPANTS_LIST_FIELDS) {
            expect(res.body.data[0]).toHaveProperty(field);
        }
    });

    test('should not display not accepted or cancelled application on /accepted', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
        const event = await generator.createEvent();
        await generator.createApplication({ user_id: 1, status: 'pending' }, event);
        await generator.createApplication({ user_id: 2, status: 'accepted', cancelled: true }, event);

        tk.travel(moment(event.participants_list_publish_deadline).add(5, 'minutes').toDate());

        const res = await request({
            path: '/events/' + event.id + '/applications/accepted',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        tk.reset();

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(0);
    });

    test('should result in an error if user does not have permission on /juridical', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
        const event = await generator.createEvent();

        const res = await request({
            path: '/events/' + event.id + '/applications/juridical',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return only required data on /juridical', async () => {
        const event = await generator.createEvent();

        await generator.createApplication({ status: 'accepted', confirmed: true, user_id: 1 }, event);
        await generator.createApplication({ user_id: 2 }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/juridical',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(1);

        expect(Object.keys(res.body.data[0]).length).toEqual(constants.ALLOWED_JURIDICAL_LIST_FIELDS.length);
        for (const field of constants.ALLOWED_JURIDICAL_LIST_FIELDS) {
            expect(res.body.data[0]).toHaveProperty(field);
        }
    });

    test('should not return not accepted, cancelled or not confirmed applications on /juridical', async () => {
        const event = await generator.createEvent();

        await generator.createApplication({ status: 'rejected', confirmed: true, cancelled: false, user_id: 1 }, event);
        await generator.createApplication({ status: 'accepted', confirmed: false, cancelled: false, user_id: 2 }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/juridical',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(0);
    });

    test('should result in an error if user does not have permission on /incoming', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
        const event = await generator.createEvent();

        const res = await request({
            path: '/events/' + event.id + '/applications/incoming',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return only required data on /incoming', async () => {
        const event = await generator.createEvent();

        await generator.createApplication({ status: 'accepted', confirmed: true, user_id: 1 }, event);
        await generator.createApplication({ user_id: 2 }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/incoming',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(1);

        const allowedFields = constants.ALLOWED_INCOMING_FIELDS.concat(['notification_email']);

        expect(Object.keys(res.body.data[0]).length).toEqual(allowedFields.length);
        for (const field of allowedFields) {
            expect(res.body.data[0]).toHaveProperty(field);
        }
    });

    test('should not return not accepted or cancelled applications on /incoming', async () => {
        const event = await generator.createEvent();

        await generator.createApplication({ status: 'rejected', cancelled: false, user_id: 1 }, event);
        await generator.createApplication({ status: 'accepted', cancelled: true, user_id: 2 }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/incoming',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(0);
    });

    test('should result in an error if user does not have permission on /network', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
        const event = await generator.createEvent();

        const res = await request({
            path: '/events/' + event.id + '/applications/network',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return only required data on /network', async () => {
        const event = await generator.createEvent();

        await generator.createApplication({ status: 'accepted', confirmed: true, user_id: 1 }, event);
        await generator.createApplication({ user_id: 2 }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/network',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(2);

        expect(Object.keys(res.body.data[0]).length).toEqual(constants.ALLOWED_NETWORK_LIST_FIELDS.length);
        for (const field of constants.ALLOWED_NETWORK_LIST_FIELDS) {
            expect(res.body.data[0]).toHaveProperty(field);
        }
    });

    test('should not return cancelled applications on /network', async () => {
        const event = await generator.createEvent();
        await generator.createApplication({ status: 'accepted', cancelled: true, user_id: 2 }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/network',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(0);
    });

    test('should leave the address out on /incoming only for the applicants core does not know', async () => {
        const event = await generator.createEvent({ applications: [] });

        // The core mock knows the notification email of user 2, not of user 1337.
        const known = await generator.createApplication({ status: 'accepted', user_id: 2 }, event);
        const unknown = await generator.createApplication({ status: 'accepted', user_id: 1337 }, event);

        const res = await request({
            path: '/events/' + event.id + '/applications/incoming',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.length).toEqual(2);

        const rowOf = (application) => res.body.data.find((row) => row.id === application.id);
        expect(rowOf(known).notification_email).toEqual('test@example.com');
        expect(rowOf(unknown)).not.toHaveProperty('notification_email');
    });

    describe('who may see which list', () => {
        const fieldsOf = {
            all: [...Object.keys(Application.rawAttributes), 'notification_email'],
            juridical: constants.ALLOWED_JURIDICAL_LIST_FIELDS,
            incoming: [...constants.ALLOWED_INCOMING_FIELDS, 'notification_email'],
            network: constants.ALLOWED_NETWORK_LIST_FIELDS
        };
        const lists = Object.keys(fieldsOf);

        // The lists each permission opens, when it is the only one the caller holds.
        const opens = {
            manage_applications: ['all', 'juridical', 'incoming', 'network'],
            manage_juridical: ['juridical'],
            manage_incoming: ['incoming'],
            update_memberslist_status: ['network'],
            approve_members: [],
            manage_event: []
        };

        const rows = Object.entries(opens).flatMap(([permission, allowed]) => lists.map((name) => [
            permission,
            name,
            allowed.includes(name) ? 200 : 403
        ]));

        const list = (event, name) => request({
            path: '/events/' + event.id + '/applications/' + name,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        // An application that every list has: accepted, confirmed and of a user core knows.
        const createListedApplication = (event) => generator.createApplication({
            user_id: 2,
            status: 'accepted',
            confirmed: true
        }, event);

        test.each(rows)('global:%s:agora alone answers /%s of an Agora with %i', async (permission, name, status) => {
            mock.mockAll({ mainPermissions: { permissions: [`global:${permission}:agora`] } });

            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const application = await createListedApplication(event);

            const res = await list(event, name);

            expect(res.statusCode).toEqual(status);

            if (status === 403) {
                expect(res.body.success).toEqual(false);
                expect(res.body).toHaveProperty('message');
                expect(res.body).not.toHaveProperty('data');
                return;
            }

            expect(res.body.meta.count).toEqual(1);
            expect(res.body.data[0].id).toEqual(application.id);
            expect(Object.keys(res.body.data[0]).sort()).toEqual([...fieldsOf[name]].sort());
        });

        test.each(rows.filter(([, , status]) => status === 200))(
            'global:%s:epm alone answers /%s of an Agora with 403',
            async (permission, name) => {
                mock.mockAll({ mainPermissions: { permissions: [`global:${permission}:epm`] } });

                const event = await generator.createEvent({ type: 'agora', applications: [] });
                await createListedApplication(event);

                const res = await list(event, name);

                expect(res.statusCode).toEqual(403);
                expect(res.body.success).toEqual(false);
                expect(res.body).not.toHaveProperty('data');
            }
        );

        test('global:manage_applications:spm opens the lists of an SPM', async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:manage_applications:spm'] } });

            const event = await generator.createEvent({ type: 'spm', applications: [] });
            const application = await createListedApplication(event);

            for (const name of lists) {
                const res = await list(event, name);

                expect(res.statusCode).toEqual(200);
                expect(res.body.data.map((row) => row.id)).toEqual([application.id]);
            }
        });
    });

    // The participants list opens after the deadline: at the deadline itself it is still closed,
    // although the applicants read their status from that moment on.
    describe('the participants list deadline on /accepted', () => {
        const listAccepted = (event) => request({
            path: '/events/' + event.id + '/applications/accepted',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        test.each([
            ['refuses a member 1 ms before the deadline', -1, 403],
            ['refuses a member exactly at the deadline (exclusive)', 0, 403],
            ['shows a member the list 1 ms after the deadline', 1, 200]
        ])('%s', async (name, offset, status) => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });

            const event = await generator.createEvent({ applications: [] });
            const application = await generator.createApplication({ status: 'accepted' }, event);

            tk.freeze(moment(event.participants_list_publish_deadline).add(offset, 'ms').toDate());

            const res = await listAccepted(event);

            expect(res.statusCode).toEqual(status);
            expect(res.body.success).toEqual(status === 200);

            if (status === 200) {
                expect(res.body.data.map((row) => row.id)).toEqual([application.id]);
            } else {
                expect(res.body).not.toHaveProperty('data');
            }
        });

        test('shows the list before the deadline to those who manage the applications', async () => {
            mock.mockAll({ mainPermissions: { permissions: ['global:manage_applications:agora'] } });

            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const application = await generator.createApplication({ status: 'accepted' }, event);

            tk.freeze(moment(event.participants_list_publish_deadline).subtract(1, 'ms').toDate());

            const res = await listAccepted(event);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.map((row) => row.id)).toEqual([application.id]);
        });

        test.each([
            'global:manage_incoming:agora',
            'global:manage_juridical:agora',
            'global:update_memberslist_status:agora',
            'global:approve_members:agora',
            'global:manage_applications:epm'
        ])('refuses a holder of %s alone before the deadline of an Agora', async (permission) => {
            mock.mockAll({ mainPermissions: { permissions: [permission] } });

            const event = await generator.createEvent({ type: 'agora', applications: [] });
            await generator.createApplication({ status: 'accepted' }, event);

            tk.freeze(moment(event.participants_list_publish_deadline).subtract(1, 'ms').toDate());

            const res = await listAccepted(event);

            expect(res.statusCode).toEqual(403);
            expect(res.body).not.toHaveProperty('data');
        });

        test('sorts the list by body, then participant type, then order, those without a type last', async () => {
            mock.mockAll({ mainPermissions: { noPermissions: true } });

            const event = await generator.createEvent({ applications: [] });
            const create = (fields) => generator.createApplication({ status: 'accepted', ...fields }, event);

            const untyped = await create({ body_id: 1, body_name: 'Aachen', participant_type: null, participant_order: null });
            const secondVisitor = await create({ body_id: 1, body_name: 'Aachen', participant_type: 'visitor', participant_order: 2 });
            const otherBody = await create({ body_id: 2, body_name: 'Brno', participant_type: 'delegate', participant_order: 1 });
            const firstVisitor = await create({ body_id: 1, body_name: 'Aachen', participant_type: 'visitor', participant_order: 1 });
            const delegate = await create({ body_id: 1, body_name: 'Aachen', participant_type: 'delegate', participant_order: 1 });

            tk.freeze(moment(event.participants_list_publish_deadline).add(1, 'ms').toDate());

            const res = await listAccepted(event);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.map((row) => row.id)).toEqual([
                delegate.id,
                firstVisitor.id,
                secondVisitor.id,
                untyped.id,
                otherBody.id
            ]);
        });
    });

    describe('displaying if the user is on memberslist', () => {
        test('should return no if no memberslist', async () => {
            const event = await generator.createEvent({ applications: [] });
            const application = await generator.createApplication({}, event);

            const res = await request({
                path: '/events/' + event.id + '/applications/all',
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).not.toHaveProperty('errors');
            expect(res.body).toHaveProperty('data');

            expect(res.body.data.length).toEqual(1);
            expect(res.body.data[0].id).toEqual(application.id);
            expect(res.body.data[0].is_on_memberslist).toEqual(false);
        });

        test('should return no if there is memberslist, but it doesnt have user', async () => {
            const event = await generator.createEvent({ applications: [] });
            const application = await generator.createApplication({ user_id: 1, first_name: 'first', last_name: 'last' }, event);
            await generator.createMembersList({
                body_id: application.body_id,
                members: [
                    generator.generateMembersListMember({ user_id: 2, first_name: 'other', last_name: 'other' })
                ]
            }, event);

            const res = await request({
                path: '/events/' + event.id + '/applications/all',
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).not.toHaveProperty('errors');
            expect(res.body).toHaveProperty('data');

            expect(res.body.data.length).toEqual(1);
            expect(res.body.data[0].id).toEqual(application.id);
            expect(res.body.data[0].is_on_memberslist).toEqual(false);
        });

        test('should return yes if there is memberslist and user_id matches', async () => {
            const event = await generator.createEvent({ applications: [] });
            const application = await generator.createApplication({ user_id: 1, first_name: 'first', last_name: 'last' }, event);
            await generator.createMembersList({
                body_id: application.body_id,
                members: [
                    generator.generateMembersListMember({ user_id: 1, first_name: 'other', last_name: 'other' })
                ]
            }, event);

            const res = await request({
                path: '/events/' + event.id + '/applications/all',
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).not.toHaveProperty('errors');
            expect(res.body).toHaveProperty('data');

            expect(res.body.data.length).toEqual(1);
            expect(res.body.data[0].id).toEqual(application.id);
            expect(res.body.data[0].is_on_memberslist).toEqual(true);
        });

        test('should return no if there is memberslist and first_name and last_name match case-sensitive', async () => {
            const event = await generator.createEvent({ applications: [] });
            const application = await generator.createApplication({ user_id: 1, first_name: 'first', last_name: 'last' }, event);
            await generator.createMembersList({
                body_id: application.body_id,
                members: [
                    generator.generateMembersListMember({ user_id: 2, first_name: 'first', last_name: 'last' })
                ]
            }, event);

            const res = await request({
                path: '/events/' + event.id + '/applications/all',
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).not.toHaveProperty('errors');
            expect(res.body).toHaveProperty('data');

            expect(res.body.data.length).toEqual(1);
            expect(res.body.data[0].id).toEqual(application.id);
            expect(res.body.data[0].is_on_memberslist).toEqual(false);
        });

        test('should return no if there is memberslist and first_name and last_name match case-insensitive', async () => {
            const event = await generator.createEvent({ applications: [] });
            const application = await generator.createApplication({ user_id: 1, first_name: 'first', last_name: 'last' }, event);
            await generator.createMembersList({
                body_id: application.body_id,
                members: [
                    generator.generateMembersListMember({ user_id: 2, first_name: 'FIRST', last_name: 'LAST' })
                ]
            }, event);

            const res = await request({
                path: '/events/' + event.id + '/applications/all',
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).not.toHaveProperty('errors');
            expect(res.body).toHaveProperty('data');

            expect(res.body.data.length).toEqual(1);
            expect(res.body.data[0].id).toEqual(application.id);
            expect(res.body.data[0].is_on_memberslist).toEqual(false);
        });
    });

    describe('pagination', () => {
        test('should use limit if provided', async () => {
            const event = await generator.createEvent();
            await generator.createApplication({ user_id: 1, first_name: 'first', last_name: 'last' }, event);
            await generator.createApplication({ user_id: 2, first_name: 'first', last_name: 'last' }, event);

            const res = await request({
                path: '/events/' + event.id + '/applications/all?limit=1',
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).not.toHaveProperty('errors');
            expect(res.body).toHaveProperty('data');
            expect(res.body.data.length).toEqual(1);
            expect(res.body.meta.count).toEqual(2);
        });

        test('should answer an empty page for a limit of zero', async () => {
            const event = await generator.createEvent();
            await generator.createApplication({ user_id: 1, first_name: 'first', last_name: 'last' }, event);
            await generator.createApplication({ user_id: 2, first_name: 'first', last_name: 'last' }, event);

            const res = await request({
                path: '/events/' + event.id + '/applications/all?limit=0',
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body.data).toEqual([]);
            expect(res.body.meta.count).toEqual(2);
        });

        test('should use offset if provided', async () => {
            const event = await generator.createEvent();
            await generator.createApplication({ user_id: 1, first_name: 'first', last_name: 'last' }, event);

            const res = await request({
                path: '/events/' + event.id + '/applications/all?offset=500',
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).not.toHaveProperty('errors');
            expect(res.body).toHaveProperty('data');
            expect(res.body.data.length).toEqual(0);
            expect(res.body.meta.count).toEqual(1);
        });
    });

    describe('sorting', () => {
        test('should respect the sorting field', async () => {
            const event = await generator.createEvent();
            await generator.createApplication({ user_id: 1, first_name: 'first2' }, event);
            await generator.createApplication({ user_id: 2, first_name: 'first1' }, event);

            const res = await request({
                path: '/events/' + event.id + '/applications/all?sort[field]=first_name', // ORDER BY first_name DESC
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).not.toHaveProperty('errors');
            expect(res.body).toHaveProperty('data');
            expect(res.body.data.length).toEqual(2);
            expect(res.body.data[0].first_name).toEqual('first2');
            expect(res.body.data[1].first_name).toEqual('first1');
        });

        test('should respect the sorting order', async () => {
            const event = await generator.createEvent();
            const first = await generator.createApplication({ user_id: 1, first_name: 'first2' }, event);
            const second = await generator.createApplication({ user_id: 2, first_name: 'first1' }, event);

            const res = await request({
                path: '/events/' + event.id + '/applications/all?sort[order]=asc', // ORDER BY id ASC
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).not.toHaveProperty('errors');
            expect(res.body).toHaveProperty('data');
            expect(res.body.data.length).toEqual(2);
            expect(res.body.data[0].id).toEqual(first.id);
            expect(res.body.data[1].id).toEqual(second.id);
        });
    });

    describe('filtering', () => {
        test('should filter by name', async () => {
            const event = await generator.createEvent();
            await generator.createApplication({ user_id: 1, first_name: 'name name' }, event);

            const res = await request({
                path: '/events/' + event.id + '/applications/all?query=name',
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).not.toHaveProperty('errors');
            expect(res.body).toHaveProperty('data');
            expect(res.body.data.length).toEqual(1);
            expect(res.body.data[0].first_name).toEqual('name name');
        });

        test('should filter by surname', async () => {
            const event = await generator.createEvent();
            await generator.createApplication({ user_id: 1, last_name: 'surname surname' }, event);

            const res = await request({
                path: '/events/' + event.id + '/applications/all?query=surname',
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).not.toHaveProperty('errors');
            expect(res.body).toHaveProperty('data');
            expect(res.body.data.length).toEqual(1);
            expect(res.body.data[0].last_name).toEqual('surname surname');
        });

        test('should return cancelled applications on displayCancelled=true', async () => {
            const event = await generator.createEvent();
            await generator.createApplication({ cancelled: true }, event);

            const res = await request({
                path: '/events/' + event.id + '/applications/all?displayCancelled=true',
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).not.toHaveProperty('errors');
            expect(res.body).toHaveProperty('data');
            expect(res.body.data.length).toEqual(1);
        });
    });

    describe('invalid sorting and paging', () => {
        const lists = ['all', 'juridical', 'incoming', 'network'];

        const list = (event, name, query) => request({
            path: '/events/' + event.id + '/applications/' + name,
            query,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        const expectBadRequest = (res) => {
            expect(res.statusCode).toEqual(400);
            expect(res.body.success).toEqual(false);
            expect(res.body).toHaveProperty('message');
            expect(res.body).not.toHaveProperty('data');
        };

        test.each(lists)('should return 400 on /%s for a sorting field that does not exist', async (name) => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });

            const res = await list(event, name, { sort: { field: 'nonexistent' } });

            expectBadRequest(res);
            expect(res.body.message).toEqual('Sorting by this field is not supported.');
        });

        // The officers' lists can only be sorted by the fields they return.
        test.each([
            ['juridical', 'visa_passport_number'],
            ['juridical', 'board_comment'],
            ['incoming', 'board_comment'],
            ['incoming', 'answers'],
            ['network', 'date_of_birth'],
            ['network', 'visa_passport_number']
        ])('should return 400 on /%s when sorting by %s, which the list does not return', async (name, field) => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            await generator.createApplication({ status: 'accepted', confirmed: true }, event);
            await generator.createApplication({ status: 'accepted', confirmed: true }, event);

            const res = await list(event, name, { sort: { field } });

            expectBadRequest(res);
        });

        test.each(lists)('should return 400 on /%s for a sorting order that does not exist', async (name) => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });

            const res = await list(event, name, { sort: { order: 'sideways' } });

            expectBadRequest(res);
            expect(res.body.message).toEqual('The sorting order should be "asc" or "desc".');
        });

        test.each([
            ['limit', 'abc'],
            ['limit', '-1'],
            ['limit', '1.5'],
            ['offset', 'abc'],
            ['offset', '-1']
        ])('should return 400 on /all if %s is "%s"', async (key, value) => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });

            const res = await list(event, 'all', { [key]: value });

            expectBadRequest(res);
            expect(res.body.message).toEqual(`The "${key}" parameter should be a whole number, zero or higher.`);
        });

        test('should still sort every list by a field it returns, in either order', async () => {
            const event = await generator.createEvent({ type: 'agora', applications: [] });
            const first = await generator.createApplication({ status: 'accepted', confirmed: true, first_name: 'Aaa' }, event);
            const second = await generator.createApplication({ status: 'accepted', confirmed: true, first_name: 'Bbb' }, event);

            for (const name of lists) {
                const ascending = await list(event, name, { sort: { field: 'first_name', order: 'ASC' }, limit: '2', offset: '0' });
                expect(ascending.statusCode).toEqual(200);
                expect(ascending.body.data.map((application) => application.id)).toEqual([first.id, second.id]);

                const descending = await list(event, name, { sort: { field: 'first_name', order: 'desc' } });
                expect(descending.statusCode).toEqual(200);
                expect(descending.body.data.map((application) => application.id)).toEqual([second.id, first.id]);
            }
        });
    });
});
