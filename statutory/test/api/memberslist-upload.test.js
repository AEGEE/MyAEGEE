const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { MembersList } = require('../../models');
const regularUser = require('../assets/oms-core-valid').data;

describe('Memberslist uploading', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        await generator.clearAll();
        mock.cleanAll();
    });

    test('should fail if user has no permissions', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true }, approvePermissions: { noPermissions: true } });

        const event = await generator.createEvent();
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

        const event = await generator.createEvent();
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

    test('should succeed if user has global permission for random body', async () => {
        mock.mockAll({ approvePermissions: { noPermissions: true } });

        const event = await generator.createEvent();
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

    test('should succeed if user has local permission for his body', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const event = await generator.createEvent();
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

    test('should fail on malformed body_id', async () => {
        const event = await generator.createEvent();
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
        const event = await generator.createEvent();
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
        const event = await generator.createEvent();
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
        const event = await generator.createEvent();
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
        const event = await generator.createEvent();
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
        const event = await generator.createEvent();
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
        const event = await generator.createEvent();
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

    test('should fail if fee is negative', async () => {
        const event = await generator.createEvent();
        const res = await request({
            uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({ members: [
                { first_name: 'test', last_name: 'test', fee: -1, user_id: 1 }
            ] }, event)
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
    });

    test('should fail if fee is NaN', async () => {
        const event = await generator.createEvent();
        const res = await request({
            uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({ members: [
                { first_name: 'test', last_name: 'test', fee: 'test', user_id: 1 }
            ] }, event)
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
    });

    test('should fail if first name is not set', async () => {
        const event = await generator.createEvent();
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
        const event = await generator.createEvent();
        const res = await request({
            uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({ members: [
                { first_name: '', last_name: 'test', fee: 3, user_id: 1 }
            ] }, event)
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
    });

    test('should fail if first name is not a string', async () => {
        const event = await generator.createEvent();
        const res = await request({
            uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({ members: [
                { first_name: false, last_name: 'test', fee: 3, user_id: 1 }
            ] }, event)
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
    });

    test('should fail if last name is not set', async () => {
        const event = await generator.createEvent();
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
        const event = await generator.createEvent();
        const res = await request({
            uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({ members: [
                { first_name: 'test', last_name: '', fee: 3, user_id: 1 }
            ] }, event)
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
    });

    test('should fail if last name is not a string', async () => {
        const event = await generator.createEvent();
        const res = await request({
            uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({ members: [
                { first_name: 'test', last_name: false, fee: 3, user_id: 1 }
            ] }, event)
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
    });

    test('should fail if user_id is not set', async () => {
        const event = await generator.createEvent();
        const res = await request({
            uri: '/events/' + event.id + '/memberslists/' + regularUser.bodies[0].id,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateMembersList({ members: [
                { first_name: 'test', last_name: 'test', fee: 3, user_id: null }
            ] }, event)
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
    });

    test('should update current members list if exists', async () => {
        const event = await generator.createEvent();
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
});
