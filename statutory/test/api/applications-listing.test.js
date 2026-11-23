const moment = require('moment');
const tk = require('timekeeper');

const { startServer, stopServer } = require('../../lib/server');
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

    test('should result in an error if user does not have permission on /juridical', async () => {
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

        test.skip('should filter by email', async () => {
            const event = await generator.createEvent();
            await generator.createApplication({ user_id: 1, email: 'testtest@aegee.eu' }, event);

            const res = await request({
                path: '/events/' + event.id + '/applications/all?query=testtest',
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
            expect(res.body.message).toMatch(/^Sorting by "nonexistent" is not supported\. The supported fields are: /);
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
