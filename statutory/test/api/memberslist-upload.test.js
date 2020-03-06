const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { MembersList, Application } = require('../../models');
const regularUser = require('../assets/oms-core-valid').data;
const conversionRates = require('../assets/conversion-rates-api');

describe('Memberslist uploading', () => {
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
        mock.cleanAll();
        await generator.clearAll();
    });

    test('should fail if user has no permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true }, approvePermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        const res = await request({
            uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({}, event)
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should fail if the body is not a local', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        const res = await request({
            uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[1].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({}, event)
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should fail if the event is not Agora', async () => {
        mock.mockAll({ approvePermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            type: 'epm',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        const res = await request({
            uri: '/events/' + event.id + '/memberslists/1337',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({}, event)
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should succeed if user has global permission for random body', async () => {
        mock.mockAll({ approvePermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        const res = await request({
            uri: '/events/' + event.id + '/memberslists/1337',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({}, event)
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
    });

    test('should succeed if user has local permission for his body on uploading new memberslist', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        const res = await request({
            uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({}, event)
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
    });

    test('should succeed if user has local permission for his body on updating memberslist', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });

        await generator.createMembersList({
            body_id: regularUser.bodies[0].id,
            user_id: regularUser.id,
            members: [{ first_name: 'test', last_name: 'test', fee: 3, user_id: 1 }]
        }, event);

        const res = await request({
            uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({}, event)
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
    });

    test('should discard fee_paid', async () => {
        mock.mockAll({ approvePermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });

        const body = generator.generateMembersList({});
        body.fee_paid = 1300;

        const res = await request({
            uri: '/events/' + event.id + '/memberslists/1337',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.fee_paid).toEqual(0);
    });

    test('should re-calculate fee to AEGEE', async () => {
        mock.mockAll({ approvePermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });

        const body = generator.generateMembersList({
            currency: 'EU', // conversion rate == 1
            fee_to_aegee: 0,
            members: [
                generator.generateMembersListMember({ fee: 100 })
            ]
        });

        const res = await request({
            uri: '/events/' + event.id + '/memberslists/1337',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.fee_to_aegee).not.toEqual(0);
    });

    test('should set fee_to_aegee to 2 if the fee to AEGEE-Europe is less than 2 EUR', async () => {
        mock.mockAll({ approvePermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });

        const body = generator.generateMembersList({
            currency: 'EU', // conversion rate == 1
            fee_to_aegee: 0,
            members: [
                generator.generateMembersListMember({ fee: 1 })
            ]
        });

        const res = await request({
            uri: '/events/' + event.id + '/memberslists/1337',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');

        expect(res.body.data.fee_to_aegee).toEqual(2);
    });

    test('should return 403 if user has local permission for his body, but deadline has passed or hasn\'t started yet', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().add(1, 'week').toDate(),
            application_period_ends: moment().add(2, 'week').toDate()
        });
        const res = await request({
            uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({}, event)
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if the body response is net error', async () => {
        mock.mockAll({ body: { netError: true } });

        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        const res = await request({
            uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({}, event)
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if the body response is not JSON', async () => {
        mock.mockAll({ body: { badResponse: true } });

        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        const res = await request({
            uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({}, event)
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if the body response is not JSON', async () => {
        mock.mockAll({ body: { unsuccessfulResponse: true } });

        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        const res = await request({
            uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({}, event)
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should fail on malformed body_id', async () => {
        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        const res = await request({
            uri: '/events/' + event.id + '/memberslists/invalid',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({}, event)
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if currency is not set', async () => {
        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        const res = await request({
            uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({ currency: null }, event)
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
    });

    test('should fail if members is not set', async () => {
        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        const membersList = generator.generateMembersList({ members: null }, event);
        delete membersList.members;

        const res = await request({
            uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: membersList
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
    });

    test('should fail if members is not an array', async () => {
        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        const res = await request({
            uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({ members: 'test' }, event)
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
    });

    test('should fail if members is empty array', async () => {
        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        const res = await request({
            uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({ members: [] }, event)
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
    });

    test('should fail if member is not an object', async () => {
        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        const res = await request({
            uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({ members: [
                false
            ] }, event)
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
    });

    test('should fail if member is null', async () => {
        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        const res = await request({
            uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({ members: [
                null
            ] }, event)
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
    });

    test('should fail if fee is not positive', async () => {
        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        const res = await request({
            uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({ members: [
                generator.generateMembersListMember({ fee: -1 })
            ] }, event)
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
    });

    test('should fail if fee is NaN', async () => {
        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        const res = await request({
            uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({ members: [
                generator.generateMembersListMember({ fee: 'test' })
            ] }, event)
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
    });

    test('should fail if first name is not set', async () => {
        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        const res = await request({
            uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({ members: [
                { last_name: 'test', fee: 3, user_id: 1 }
            ] }, event)
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
    });

    test('should fail if first name is empty string', async () => {
        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        const res = await request({
            uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({ members: [
                generator.generateMembersListMember({ first_name: '' })
            ] }, event)
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
    });

    test('should fail if first name is not a string', async () => {
        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        const res = await request({
            uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({ members: [
                generator.generateMembersListMember({ first_name: false })
            ] }, event)
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
    });

    test('should fail if last name is not set', async () => {
        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        const res = await request({
            uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({ members: [
                { first_name: 'test', fee: 3, user_id: 1 }
            ] }, event)
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
    });

    test('should fail if last name is empty string', async () => {
        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        const res = await request({
            uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({ members: [
                generator.generateMembersListMember({ last_name: '' })
            ] }, event)
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
    });

    test('should fail if last name is not a string', async () => {
        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        const res = await request({
            uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({ members: [
                generator.generateMembersListMember({ last_name: false })
            ] }, event)
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
    });

    test('should fail if user_id is set, but is not a number', async () => {
        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        const res = await request({
            uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({ members: [
                generator.generateMembersListMember({ user_id: false })
            ] }, event)
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
    });

    test('should update current members list if exists', async () => {
        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        await generator.createMembersList({
            body_id: regularUser.bodies[0].id,
            user_id: regularUser.id,
            members: [{ first_name: 'test', last_name: 'test', fee: 3, user_id: 1 }]
        }, event);

        const res = await request({
            uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({ members: [
                { first_name: 'not', last_name: 'not', fee: 5, user_id: 2 }
            ] }, event)
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');

        const membersListFromDB = await MembersList.findAll({ where: {} });
        expect(membersListFromDB.length).toEqual(1);
        expect(membersListFromDB[0].members[0].first_name).toEqual('not');
        expect(membersListFromDB[0].members[0].last_name).toEqual('not');
        expect(membersListFromDB[0].members[0].fee).toEqual(5);
        expect(membersListFromDB[0].members[0].user_id).toEqual(2);
    });

    test('should fail if user has local permission for his body on updating memberslist but after the deadline', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(7, 'days'),
            application_period_ends: moment().subtract(6, 'days'),
            board_approve_deadline: moment().subtract(5, 'days'),
            participants_list_publish_deadline: moment().subtract(4, 'days'),
            memberslist_submission_deadline: moment().subtract(3, 'days'),
            starts: moment().subtract(2, 'days'),
            ends: moment().subtract(1, 'days')
        });

        await generator.createMembersList({
            body_id: regularUser.bodies[0].id,
            user_id: regularUser.id,
            members: [{ first_name: 'test', last_name: 'test', fee: 3, user_id: 1 }]
        }, event);

        const res = await request({
            uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({}, event)
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
    });

    test('should return 422 on any extra fields', async () => {
        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        await generator.createMembersList({
            body_id: regularUser.bodies[0].id,
            user_id: regularUser.id,
            members: [{ first_name: 'test', last_name: 'test', fee: 3, user_id: 1 }]
        }, event);

        const res = await request({
            uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({ members: [
                { first_name: 'not', last_name: 'not', fee: 5, user_id: 2, extra: 'field' }
            ] }, event)
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('members');
    });

    describe('should update is_on_memberslist for user', () => {
        test('should set is_on_memberslist = true if ID matches', async () => {
            const event = await generator.createEvent({
                type: 'agora',
                application_period_starts: moment().subtract(1, 'week').toDate(),
                application_period_ends: moment().add(1, 'week').toDate()
            });
            const application = await generator.createApplication({
                user_id: 100,
                body_id: regularUser.bodies[0].id
            }, event);
            expect(application.is_on_memberslist).toEqual(false);

            const res = await request({
                uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: generator.generateMembersList({
                    members: [generator.generateMembersListMember({ user_id: 100 })]
                }, event)
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).toHaveProperty('data');

            const applicationFromDb = await Application.findByPk(application.id);
            expect(applicationFromDb.is_on_memberslist).toEqual(true);
        });

        test('should set is_on_memberslist = true if first/last name matches', async () => {
            const event = await generator.createEvent({
                type: 'agora',
                application_period_starts: moment().subtract(1, 'week').toDate(),
                application_period_ends: moment().add(1, 'week').toDate()
            });
            const application = await generator.createApplication({
                user_id: 100,
                first_name: 'testing',
                last_name: 'stuff',
                body_id: regularUser.bodies[0].id
            }, event);
            expect(application.is_on_memberslist).toEqual(false);

            const res = await request({
                uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: generator.generateMembersList({
                    members: [generator.generateMembersListMember({
                        user_id: null,
                        first_name: 'testing',
                        last_name: 'stuff'
                    })]
                }, event)
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).toHaveProperty('data');

            const applicationFromDb = await Application.findByPk(application.id);
            expect(applicationFromDb.is_on_memberslist).toEqual(true);
        });

        test('should set is_on_memberslist = false if no match', async () => {
            const event = await generator.createEvent({
                type: 'agora',
                application_period_starts: moment().subtract(1, 'week').toDate(),
                application_period_ends: moment().add(1, 'week').toDate()
            });
            await generator.createMembersList({
                body_id: regularUser.bodies[0].id,
                members: [generator.generateMembersListMember({
                    user_id: 100,
                    first_name: 'testing',
                    last_name: 'stuff'
                })]
            }, event);
            const application = await generator.createApplication({
                user_id: 100,
                first_name: 'testing',
                last_name: 'stuff',
                body_id: regularUser.bodies[0].id
            }, event);
            expect(application.is_on_memberslist).toEqual(true);

            const res = await request({
                uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: generator.generateMembersList({
                    members: [generator.generateMembersListMember({
                        user_id: 200,
                        first_name: 'another',
                        last_name: 'name'
                    })]
                }, event)
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).toHaveProperty('data');

            const applicationFromDb = await Application.findByPk(application.id);
            expect(applicationFromDb.is_on_memberslist).toEqual(false);
        });
    });

    describe('calculating conversion rate', () => {
        test('should calculate conversion rate if it is in the list', async () => {
            const event = await generator.createEvent({
                type: 'agora',
                application_period_starts: moment().subtract(1, 'week').toDate(),
                application_period_ends: moment().add(1, 'week').toDate()
            });
            const res = await request({
                uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: generator.generateMembersList({ currency: 'HU' }, event)
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).toHaveProperty('data');

            const conversionForTest = conversionRates.find(rate => rate.isoA2Code === 'HU');
            expect(res.body.data.conversion_rate).toEqual(conversionForTest.value);
        });

        test('should calculate conversion rate if it is in the "special" list', async () => {
            const event = await generator.createEvent({
                type: 'agora',
                application_period_starts: moment().subtract(1, 'week').toDate(),
                application_period_ends: moment().add(1, 'week').toDate()
            });

            // EU is BE in the conversion rate API.
            const res = await request({
                uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: generator.generateMembersList({ currency: 'EU' }, event)
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).toHaveProperty('data');

            const conversionForTest = conversionRates.find(rate => rate.isoA2Code === 'BE');
            expect(res.body.data.conversion_rate).toEqual(conversionForTest.value);
        });

        test('should return 500 if the currency is not in a list', async () => {
            const event = await generator.createEvent({
                type: 'agora',
                application_period_starts: moment().subtract(1, 'week').toDate(),
                application_period_ends: moment().add(1, 'week').toDate()
            });

            // EU is BE in the conversion rate API.
            const res = await request({
                uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: generator.generateMembersList({ currency: 'TEST' }, event)
            });

            expect(res.statusCode).toEqual(500);
            expect(res.body.success).toEqual(false);
            expect(res.body).not.toHaveProperty('data');
            expect(res.body).toHaveProperty('message');
        });

        test('should return 500 on conversion rate API\'s net error ', async () => {
            mock.mockAll({ conversion: { netError: true } });

            const event = await generator.createEvent({
                type: 'agora',
                application_period_starts: moment().subtract(1, 'week').toDate(),
                application_period_ends: moment().add(1, 'week').toDate()
            });

            // EU is BE in the conversion rate API.
            const res = await request({
                uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: generator.generateMembersList({ currency: 'HU' }, event)
            });

            expect(res.statusCode).toEqual(500);
            expect(res.body.success).toEqual(false);
            expect(res.body).not.toHaveProperty('data');
            expect(res.body).toHaveProperty('message');
        });

        test('should return 500 on conversion rate API\'s bad response ', async () => {
            mock.mockAll({ conversion: { badResponse: true } });

            const event = await generator.createEvent({
                type: 'agora',
                application_period_starts: moment().subtract(1, 'week').toDate(),
                application_period_ends: moment().add(1, 'week').toDate()
            });

            // EU is BE in the conversion rate API.
            const res = await request({
                uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: generator.generateMembersList({ currency: 'HU' }, event)
            });

            expect(res.statusCode).toEqual(500);
            expect(res.body.success).toEqual(false);
            expect(res.body).not.toHaveProperty('data');
            expect(res.body).toHaveProperty('message');
        });
    });
});
