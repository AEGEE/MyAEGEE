const moment = require('moment');
const tk = require('timekeeper');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { MembersList, Application } = require('../../models');
const regularUser = require('../assets/core-valid.json').data;
const conversionRates = require('../assets/conversion-rates-api.json');

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
        mock.mockAll({ mainPermissions: { noPermissions: true }, approvePermissions: { noPermissions: true }, memberslistPermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        const res = await request({
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
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
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[1].id,
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
            path: '/events/' + event.id + '/memberslists/1337',
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
            path: '/events/' + event.id + '/memberslists/1337',
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
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
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
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({}, event)
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
    });

    test('should fail if user has only approve_members but not manage_memberslist permission', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true }, memberslistPermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        const res = await request({
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({}, event)
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
    });

    test('should succeed if user has manage_memberslist but not approve_members permission', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true }, approvePermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        const res = await request({
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({}, event)
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
    });

    test('should succeed if user has the late permission on uploading new memberslist for his body and the deadline has passed', async () => {
        mock.mockAll({ mainPermissions: { latePermissions: true } });

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
        const res = await request({
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({}, event)
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
    });

    test('should return 403 if user has the late permission in another scope than global and the deadline has passed', async () => {
        mock.mockAll({ mainPermissions: { permissions: ['local:memberslist_late:agora'] } });

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
        const res = await request({
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({}, event)
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
    });

    test('should succeed if user has the late permission on updating memberslist for his body and the deadline has passed', async () => {
        mock.mockAll({ mainPermissions: { latePermissions: true } });

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
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({}, event)
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
    });

    test('should fail to update memberslist between submission and edit deadlines without dedicated permission', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(21, 'days'),
            application_period_ends: moment().subtract(20, 'days'),
            board_approve_deadline: moment().subtract(19, 'days'),
            participants_list_publish_deadline: moment().subtract(18, 'days'),
            memberslist_submission_deadline: moment().subtract(1, 'days'),
            starts: moment().add(20, 'days'),
            ends: moment().add(21, 'days')
        });

        await generator.createMembersList({
            body_id: regularUser.bodies[0].id,
            user_id: regularUser.id,
            members: [{ first_name: 'test', last_name: 'test', fee: 3, user_id: 1 }]
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({}, event)
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
    });

    test('should fail to update memberslist between submission and edit deadlines with dedicated local permission', async () => {
        mock.mockAll({ mainPermissions: { editBetweenDeadlinesLocalPermissions: true } });

        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(21, 'days'),
            application_period_ends: moment().subtract(20, 'days'),
            board_approve_deadline: moment().subtract(19, 'days'),
            participants_list_publish_deadline: moment().subtract(18, 'days'),
            memberslist_submission_deadline: moment().subtract(1, 'days'),
            starts: moment().add(20, 'days'),
            ends: moment().add(21, 'days')
        });

        await generator.createMembersList({
            body_id: regularUser.bodies[0].id,
            user_id: regularUser.id,
            members: [{ first_name: 'test', last_name: 'test', fee: 3, user_id: 1 }]
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({}, event)
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
    });

    test('should fail to update memberslist between submission and edit deadlines with global approve permission only', async () => {
        mock.mockAll({ approvePermissions: { noPermissions: true } });

        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(21, 'days'),
            application_period_ends: moment().subtract(20, 'days'),
            board_approve_deadline: moment().subtract(19, 'days'),
            participants_list_publish_deadline: moment().subtract(18, 'days'),
            memberslist_submission_deadline: moment().subtract(1, 'days'),
            starts: moment().add(20, 'days'),
            ends: moment().add(21, 'days')
        });

        await generator.createMembersList({
            body_id: regularUser.bodies[0].id,
            user_id: regularUser.id,
            members: [{ first_name: 'test', last_name: 'test', fee: 3, user_id: 1 }]
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({}, event)
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
    });

    test('should succeed to update memberslist between submission and edit deadlines with dedicated global permission', async () => {
        mock.mockAll({
            mainPermissions: { editBetweenDeadlinesGlobalPermissions: true },
            approvePermissions: { noPermissions: true }
        });

        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(21, 'days'),
            application_period_ends: moment().subtract(20, 'days'),
            board_approve_deadline: moment().subtract(19, 'days'),
            participants_list_publish_deadline: moment().subtract(18, 'days'),
            memberslist_submission_deadline: moment().subtract(1, 'days'),
            starts: moment().add(20, 'days'),
            ends: moment().add(21, 'days')
        });

        await generator.createMembersList({
            body_id: regularUser.bodies[0].id,
            user_id: regularUser.id,
            members: [{ first_name: 'test', last_name: 'test', fee: 3, user_id: 1 }]
        }, event);

        const res = await request({
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
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
            path: '/events/' + event.id + '/memberslists/1337',
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
            path: '/events/' + event.id + '/memberslists/1337',
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
            path: '/events/' + event.id + '/memberslists/1337',
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
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
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
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
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
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
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
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
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
            path: '/events/' + event.id + '/memberslists/invalid',
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
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
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
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
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
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
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
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
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
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
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
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
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
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
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
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
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
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
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
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
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
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
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
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
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
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
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
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
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
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
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
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
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
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
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
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
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
                path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
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

        test('should set is_on_memberslist = false if first/last name matches', async () => {
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
                path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
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
            expect(applicationFromDb.is_on_memberslist).toEqual(false);
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
                path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
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
                path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: generator.generateMembersList({ currency: 'HU' }, event)
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).toHaveProperty('data');

            const conversionForTest = conversionRates.find((rate) => rate.isoA2Code === 'HU');
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
                path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: generator.generateMembersList({ currency: 'EU' }, event)
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toEqual(true);
            expect(res.body).toHaveProperty('data');

            const conversionForTest = conversionRates.find((rate) => rate.isoA2Code === 'BE');
            expect(res.body.data.conversion_rate).toEqual(conversionForTest.value);
        });

        test('should return 422 if the currency is not in a list', async () => {
            const event = await generator.createEvent({
                type: 'agora',
                application_period_starts: moment().subtract(1, 'week').toDate(),
                application_period_ends: moment().add(1, 'week').toDate()
            });

            // EU is BE in the conversion rate API.
            const res = await request({
                path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: generator.generateMembersList({ currency: 'TEST' }, event)
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.success).toEqual(false);
            expect(res.body).not.toHaveProperty('data');
            expect(res.body.errors.currency).toEqual(['The currency is not known.']);
            expect(await MembersList.count()).toEqual(0);
        });

        test('should return 422 when changing the currency of a memberslist to one that is not in a list', async () => {
            const event = await generator.createEvent({
                type: 'agora',
                application_period_starts: moment().subtract(1, 'week').toDate(),
                application_period_ends: moment().add(1, 'week').toDate()
            });
            await generator.createMembersList({ body_id: regularUser.bodies[0].id, currency: 'EU' }, event);

            const res = await request({
                path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: generator.generateMembersList({ currency: 'TEST' }, event)
            });

            expect(res.statusCode).toEqual(422);
            expect(res.body.errors.currency).toEqual(['The currency is not known.']);

            const memberslistFromDb = await MembersList.findOne({ where: { event_id: event.id } });
            expect(memberslistFromDb.currency).toEqual('EU');
        });

        test('should return 503 on conversion rate API\'s net error', async () => {
            mock.mockAll({ conversion: { netError: true } });

            const event = await generator.createEvent({
                type: 'agora',
                application_period_starts: moment().subtract(1, 'week').toDate(),
                application_period_ends: moment().add(1, 'week').toDate()
            });

            // EU is BE in the conversion rate API.
            const res = await request({
                path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: generator.generateMembersList({ currency: 'HU' }, event)
            });

            expect(res.statusCode).toEqual(503);
            expect(res.body.success).toEqual(false);
            expect(res.body).not.toHaveProperty('data');
            expect(res.body).toHaveProperty('message');
        });

        test('should return 503 on conversion rate API\'s bad response', async () => {
            mock.mockAll({ conversion: { badResponse: true } });

            const event = await generator.createEvent({
                type: 'agora',
                application_period_starts: moment().subtract(1, 'week').toDate(),
                application_period_ends: moment().add(1, 'week').toDate()
            });

            // EU is BE in the conversion rate API.
            const res = await request({
                path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
                method: 'POST',
                headers: { 'X-Auth-Token': 'blablabla' },
                body: generator.generateMembersList({ currency: 'HU' }, event)
            });

            expect(res.statusCode).toEqual(503);
            expect(res.body.success).toEqual(false);
            expect(res.body).not.toHaveProperty('data');
            expect(res.body).toHaveProperty('message');
        });
    });

    test('should store the fee and the user ID of a member as numbers and trim the names', async () => {
        const event = await generator.createEvent({
            type: 'agora',
            application_period_starts: moment().subtract(1, 'week').toDate(),
            application_period_ends: moment().add(1, 'week').toDate()
        });
        const application = await generator.createApplication({ user_id: 7, body_id: regularUser.bodies[0].id }, event);

        const res = await request({
            path: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: {
                currency: 'EU',
                members: [
                    { first_name: ' Anna ', last_name: ' Member ', user_id: '7', fee: '0' },
                    { first_name: 'Bob', last_name: 'Member', fee: '20.5' }
                ]
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.members).toMatchObject([
            { first_name: 'Anna', last_name: 'Member', user_id: 7, fee: 0 },
            { first_name: 'Bob', last_name: 'Member', fee: 20.5 }
        ]);

        const memberslistFromDb = await MembersList.findOne({ where: { event_id: event.id } });
        expect(memberslistFromDb.getDataValue('members')).toEqual([
            { first_name: 'Anna', last_name: 'Member', user_id: 7, fee: 0 },
            { first_name: 'Bob', last_name: 'Member', fee: 20.5 }
        ]);

        // The member with that user ID is on the list.
        const applicationFromDb = await Application.findByPk(application.id);
        expect(applicationFromDb.is_on_memberslist).toEqual(true);
    });

    describe('deadlines', () => {
        // Fixed dates, in a month without clock changes: the edit deadline is 14 days before the start.
        const PERIOD_STARTS = new Date('2031-06-01T10:00:00.000Z');
        const SUBMISSION_DEADLINE = new Date('2031-07-01T10:00:00.000Z');
        const EDIT_DEADLINE = new Date('2031-07-06T10:00:00.000Z');
        const EVENT_STARTS = new Date('2031-07-20T10:00:00.000Z');

        const MANAGE = 'global:manage_memberslist:agora';
        const BETWEEN = 'global:edit_memberslist_between_deadlines:agora';
        const LATE_LOCAL = 'local:memberslist_late:agora';
        const LATE_GLOBAL = 'global:memberslist_late:agora';

        const bodyId = regularUser.bodies[0].id;
        const storedMembers = [{ first_name: 'stored', last_name: 'stored', fee: 3, user_id: 1 }];
        const sentMembers = [{ first_name: 'sent', last_name: 'sent', fee: 5, user_id: 2 }];

        const ms = (date, offset) => new Date(date.getTime() + offset);

        // The board of the local: the default mocks make the caller a board member of their first body.
        // The manager holds global:manage_memberslist:agora and is on no board.
        const callers = {
            board: { name: 'the board of the local', mocks: (permissions) => ({ mainPermissions: { permissions } }) },
            manager: {
                name: 'a holder of ' + MANAGE,
                mocks: (permissions) => ({
                    mainPermissions: { permissions: [MANAGE, ...permissions] },
                    memberslistPermissions: { noPermissions: true }
                })
            },
            member: {
                name: 'a member',
                mocks: (permissions) => ({
                    mainPermissions: { permissions },
                    memberslistPermissions: { noPermissions: true }
                })
            }
        };

        // A row of the tables below: who, with which extra permissions, when, and the answer.
        const row = (verb, caller, permissions, when, date) => [
            `${verb} ${callers[caller].name}${permissions.length ? ' with ' + permissions.join(' and ') : ''} ${when}`,
            verb === 'accepts' ? 200 : 403,
            caller,
            permissions,
            date
        ];

        const createAgora = () => generator.createEvent({
            type: 'agora',
            application_period_starts: PERIOD_STARTS,
            application_period_ends: new Date('2031-06-10T10:00:00.000Z'),
            board_approve_deadline: new Date('2031-06-15T10:00:00.000Z'),
            participants_list_publish_deadline: new Date('2031-06-20T10:00:00.000Z'),
            memberslist_submission_deadline: SUBMISSION_DEADLINE,
            starts: EVENT_STARTS,
            ends: new Date('2031-07-25T10:00:00.000Z')
        });

        const upload = (event) => request({
            path: '/events/' + event.id + '/memberslists/' + bodyId,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { currency: 'EU', members: sentMembers }
        });

        const membersInDb = async () => {
            const memberslists = await MembersList.findAll({ where: {} });
            return memberslists.map((memberslist) => memberslist.members.map((member) => member.first_name));
        };

        afterEach(() => {
            tk.reset();
        });

        test('the edit deadline is 14 days before the event starts', async () => {
            const event = await createAgora();

            expect(event.memberslist_edit_deadline).toEqual(EDIT_DEADLINE);
        });

        describe('of a first members list', () => {
            test.each([
                row('refuses', 'board', [], '1 ms before the application period starts', ms(PERIOD_STARTS, -1)),
                row('accepts', 'board', [], 'exactly when the application period starts (inclusive)', PERIOD_STARTS),
                row('accepts', 'board', [], 'exactly at the submission deadline (inclusive)', SUBMISSION_DEADLINE),
                row('refuses', 'board', [], '1 ms after the submission deadline', ms(SUBMISSION_DEADLINE, 1)),
                row('refuses', 'board', [BETWEEN], '1 ms after the submission deadline', ms(SUBMISSION_DEADLINE, 1)),
                row('accepts', 'board', [LATE_LOCAL], '1 ms after the submission deadline', ms(SUBMISSION_DEADLINE, 1)),
                row('accepts', 'board', [LATE_GLOBAL], '1 ms after the submission deadline', ms(SUBMISSION_DEADLINE, 1)),
                row('accepts', 'board', [LATE_LOCAL], 'after the event started', ms(EVENT_STARTS, 1)),
                row('refuses', 'member', [LATE_GLOBAL], '1 ms after the submission deadline', ms(SUBMISSION_DEADLINE, 1)),
                row('accepts', 'manager', [], '1 ms before the application period starts', ms(PERIOD_STARTS, -1)),
                row('accepts', 'manager', [], '1 ms after the submission deadline', ms(SUBMISSION_DEADLINE, 1)),
                row('accepts', 'manager', [], '1 ms after the edit deadline', ms(EDIT_DEADLINE, 1))
            ])('%s', async (name, status, caller, permissions, date) => {
                mock.mockAll(callers[caller].mocks(permissions));
                const event = await createAgora();

                tk.freeze(date);
                const res = await upload(event);

                expect(res.statusCode).toEqual(status);
                if (status === 200) {
                    expect(await membersInDb()).toEqual([['sent']]);
                } else {
                    expect(res.body).toEqual({ success: false, message: 'You are not allowed to upload memberslist.' });
                    expect(await membersInDb()).toEqual([]);
                }
            });
        });

        describe('of an edit of a members list', () => {
            test.each([
                row('refuses', 'board', [], '1 ms before the application period starts', ms(PERIOD_STARTS, -1)),
                row('accepts', 'board', [], 'exactly when the application period starts (inclusive)', PERIOD_STARTS),
                row('accepts', 'board', [], 'exactly at the submission deadline (inclusive)', SUBMISSION_DEADLINE),
                row('refuses', 'board', [], '1 ms after the submission deadline', ms(SUBMISSION_DEADLINE, 1)),
                row('accepts', 'board', [BETWEEN], '1 ms after the submission deadline', ms(SUBMISSION_DEADLINE, 1)),
                row('refuses', 'board', [], 'exactly at the edit deadline', EDIT_DEADLINE),
                row('accepts', 'board', [BETWEEN], 'exactly at the edit deadline (inclusive)', EDIT_DEADLINE),
                row('refuses', 'board', [BETWEEN], '1 ms after the edit deadline', ms(EDIT_DEADLINE, 1)),
                row('accepts', 'board', [LATE_LOCAL], '1 ms after the edit deadline', ms(EDIT_DEADLINE, 1)),
                row('accepts', 'board', [LATE_GLOBAL], '1 ms after the edit deadline', ms(EDIT_DEADLINE, 1)),
                // BUG: the late permission lets a board edit after the edit deadline, but not in the days before it:
                // between the deadlines it still needs the permission for that period. Expected: accepted.
                row('refuses', 'board', [LATE_LOCAL], '1 ms after the submission deadline', ms(SUBMISSION_DEADLINE, 1)),
                row('refuses', 'board', [LATE_LOCAL], 'exactly at the edit deadline', EDIT_DEADLINE),
                row('accepts', 'board', [LATE_LOCAL, BETWEEN], '1 ms after the submission deadline', ms(SUBMISSION_DEADLINE, 1)),
                row('refuses', 'member', [BETWEEN], '1 ms after the submission deadline', ms(SUBMISSION_DEADLINE, 1)),
                row('accepts', 'manager', [], '1 ms before the application period starts', ms(PERIOD_STARTS, -1)),
                row('accepts', 'manager', [], 'exactly at the submission deadline (inclusive)', SUBMISSION_DEADLINE),
                row('refuses', 'manager', [], '1 ms after the submission deadline', ms(SUBMISSION_DEADLINE, 1)),
                row('accepts', 'manager', [BETWEEN], '1 ms after the submission deadline', ms(SUBMISSION_DEADLINE, 1)),
                row('refuses', 'manager', [], 'exactly at the edit deadline', EDIT_DEADLINE),
                row('accepts', 'manager', [BETWEEN], 'exactly at the edit deadline (inclusive)', EDIT_DEADLINE),
                // BUG: a manager needs the permission for the period between the deadlines, but nothing more
                // than global:manage_memberslist once the edit deadline has passed. Expected: refused, or the
                // manager is not bound by the period between the deadlines either.
                row('accepts', 'manager', [], '1 ms after the edit deadline', ms(EDIT_DEADLINE, 1))
            ])('%s', async (name, status, caller, permissions, date) => {
                mock.mockAll(callers[caller].mocks(permissions));
                const event = await createAgora();
                await generator.createMembersList({ body_id: bodyId, user_id: regularUser.id, members: storedMembers }, event);

                tk.freeze(date);
                const res = await upload(event);

                expect(res.statusCode).toEqual(status);
                if (status === 200) {
                    expect(await membersInDb()).toEqual([['sent']]);
                } else {
                    expect(res.body).toEqual({ success: false, message: 'You are not allowed to edit memberslist.' });
                    expect(await membersInDb()).toEqual([['stored']]);
                }
            });
        });
    });
});
