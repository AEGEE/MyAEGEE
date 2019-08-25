const moment = require('moment');
const tk = require('timekeeper');

const { startServer, stopServer } = require('../../lib/server.js');
const constants = require('../../lib/constants');

const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');

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
        await generator.clearAll();
        mock.cleanAll();
    });

    test('should display everything if the user has permissions on /all', async () => {
        const event = await generator.createEvent();

        const res = await request({
            uri: '/events/' + event.id + '/applications/all',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        const applicationIds = event.applications.map(a => a.id);
        expect(res.body.data.length).toEqual(applicationIds.length);

        for (const application of res.body.data) {
            expect(applicationIds).toContain(application.id);
        }
    });

    test('should result in an error if user does not have permission on /all', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });
        const event = await generator.createEvent();

        const res = await request({
            uri: '/events/' + event.id + '/applications/all',
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
            uri: '/events/' + event.id + '/applications/accepted',
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
            uri: '/events/' + event.id + '/applications/accepted',
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
            uri: '/events/' + event.id + '/applications/accepted',
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
            uri: '/events/' + event.id + '/applications/juridical',
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

        await generator.createApplication({ status: 'accepted', paid_fee: true, user_id: 1 }, event);
        await generator.createApplication({ user_id: 2 }, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/juridical',
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

        await generator.createApplication({ status: 'rejected', paid_fee: true, cancelled: false, user_id: 1 }, event);
        await generator.createApplication({ status: 'accepted', paid_fee: false, cancelled: false, user_id: 2 }, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/juridical',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

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
            uri: '/events/' + event.id + '/applications/incoming',
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

        await generator.createApplication({ status: 'accepted', paid_fee: true, user_id: 1 }, event);
        await generator.createApplication({ user_id: 2 }, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/incoming',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(1);

        expect(Object.keys(res.body.data[0]).length).toEqual(constants.ALLOWED_INCOMING_FIELDS.length);
        for (const field of constants.ALLOWED_INCOMING_FIELDS) {
            expect(res.body.data[0]).toHaveProperty(field);
        }
    });

    test('should not return not accepted or cancelled applications on /incoming', async () => {
        const event = await generator.createEvent();

        await generator.createApplication({ status: 'rejected', cancelled: false, user_id: 1 }, event);
        await generator.createApplication({ status: 'accepted', cancelled: true, user_id: 2 }, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/incoming',
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
            uri: '/events/' + event.id + '/applications/network',
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

        await generator.createApplication({ status: 'accepted', paid_fee: true, user_id: 1 }, event);
        await generator.createApplication({ user_id: 2 }, event);

        const res = await request({
            uri: '/events/' + event.id + '/applications/network',
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
            uri: '/events/' + event.id + '/applications/network',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(0);
    });

    describe('displaying if the user is on memberslist', () => {
        test('should return no if no memberslist', async () => {
            const event = await generator.createEvent({ applications: [] });
            const application = await generator.createApplication({}, event);

            const res = await request({
                uri: '/events/' + event.id + '/applications/all',
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
                uri: '/events/' + event.id + '/applications/all',
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
                uri: '/events/' + event.id + '/applications/all',
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

        test('should return yes if there is memberslist and first_name and last_name match case-sensitive', async () => {
            const event = await generator.createEvent({ applications: [] });
            const application = await generator.createApplication({ user_id: 1, first_name: 'first', last_name: 'last' }, event);
            await generator.createMembersList({
                body_id: application.body_id,
                members: [
                    generator.generateMembersListMember({ user_id: 2, first_name: 'first', last_name: 'last' })
                ]
            }, event);

            const res = await request({
                uri: '/events/' + event.id + '/applications/all',
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

        test('should return yes if there is memberslist and first_name and last_name match case-insensitive', async () => {
            const event = await generator.createEvent({ applications: [] });
            const application = await generator.createApplication({ user_id: 1, first_name: 'first', last_name: 'last' }, event);
            await generator.createMembersList({
                body_id: application.body_id,
                members: [
                    generator.generateMembersListMember({ user_id: 2, first_name: 'FIRST', last_name: 'LAST' })
                ]
            }, event);

            const res = await request({
                uri: '/events/' + event.id + '/applications/all',
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
    });

    describe('pagination', () => {
        test('should use limit if provided', async () => {
            const event = await generator.createEvent();
            await generator.createApplication({ user_id: 1, first_name: 'first', last_name: 'last' }, event);
            await generator.createApplication({ user_id: 2, first_name: 'first', last_name: 'last' }, event);

            const res = await request({
                uri: '/events/' + event.id + '/applications/all?limit=1',
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

        test('should use offset if provided', async () => {
            const event = await generator.createEvent();
            await generator.createApplication({ user_id: 1, first_name: 'first', last_name: 'last' }, event);

            const res = await request({
                uri: '/events/' + event.id + '/applications/all?offset=500',
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
                uri: '/events/' + event.id + '/applications/all?sort[field]=first_name', // ORDER BY first_name DESC
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
                uri: '/events/' + event.id + '/applications/all?sort[order]=asc', // ORDER BY id ASC
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
                uri: '/events/' + event.id + '/applications/all?query=name',
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
                uri: '/events/' + event.id + '/applications/all?query=surname',
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

        test('should filter by email', async () => {
            const event = await generator.createEvent();
            await generator.createApplication({ user_id: 1, email: 'testtest@aegee.eu' }, event);

            const res = await request({
                uri: '/events/' + event.id + '/applications/all?query=testtest',
                method: 'GET',
                headers: { 'X-Auth-Token': 'blablabla' }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).not.toHaveProperty('errors');
            expect(res.body).toHaveProperty('data');
            expect(res.body.data.length).toEqual(1);
            expect(res.body.data[0].email).toEqual('testtest@aegee.eu');
        });

        test('should return cancelled applications on displayCancelled=true', async () => {
            const event = await generator.createEvent();
            await generator.createApplication({ cancelled: true }, event);

            const res = await request({
                uri: '/events/' + event.id + '/applications/all?displayCancelled=true',
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
});
