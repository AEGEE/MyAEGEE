const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const mock = require('../scripts/mock');
const { BodyMembership } = require('../../models');

describe('Campaign submission', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        await mock.mockAll();
    });

    afterEach(async () => {
        await generator.clearAll();
        await mock.cleanAll();
    });

    test('should fail if the campaign is not found', async () => {
        const user = generator.generateUser();

        const res = await request({
            uri: '/signup/asdasdas',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: user
        });

        expect(res.statusCode).toEqual(404);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if the campaign is not active', async () => {
        const campaign = await generator.createCampaign({ active: false });
        const user = generator.generateUser();

        const res = await request({
            uri: '/signup/' + campaign.url,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: user
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('message');
    });

    test('should fail if the username is invalid', async () => {
        const campaign = await generator.createCampaign();
        const user = generator.generateUser({ username: 'not valid username ' });

        const res = await request({
            uri: '/signup/' + campaign.url,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: user
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('username');
    });

    test('should fail if the username has no letters', async () => {
        const campaign = await generator.createCampaign();
        const user = generator.generateUser({ username: '123' });

        const res = await request({
            uri: '/signup/' + campaign.url,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: user
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('username');
    });

    test('should fail if the first name is invalid', async () => {
        const campaign = await generator.createCampaign();
        const user = generator.generateUser({ first_name: '!@#!@#D' });

        const res = await request({
            uri: '/signup/' + campaign.url,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: user
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('first_name');
    });

    test('should fail if the last name is invalid', async () => {
        const campaign = await generator.createCampaign();
        const user = generator.generateUser({ last_name: '!@#!@#D' });

        const res = await request({
            uri: '/signup/' + campaign.url,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: user
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('last_name');
    });

    test('should fail if the email is not set', async () => {
        const campaign = await generator.createCampaign();
        const user = generator.generateUser({ email: null });

        const res = await request({
            uri: '/signup/' + campaign.url,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: user
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('email');
    });

    test('should fail if the password is not set', async () => {
        const campaign = await generator.createCampaign();
        const user = generator.generateUser({ password: null });

        const res = await request({
            uri: '/signup/' + campaign.url,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: user
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('password');
    });

    test('should fail if the username is not set', async () => {
        const campaign = await generator.createCampaign();
        const user = generator.generateUser({ username: null });

        const res = await request({
            uri: '/signup/' + campaign.url,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: user
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('username');
    });

    test('should succeed when everything is okay', async () => {
        const campaign = await generator.createCampaign({});
        const user = generator.generateUser();

        const res = await request({
            uri: '/signup/' + campaign.url,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: user
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
    });

    test('should create a body membership if autojoin_body_id is provided', async () => {
        const body = await generator.createBody();
        const campaign = await generator.createCampaign({ autojoin_body_id: body.id });
        const user = generator.generateUser();

        const res = await request({
            uri: '/signup/' + campaign.url,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: user
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        const membershipFromDb = await BodyMembership.findOne({
            where: {
                body_id: body.id,
                user_id: res.body.data.id
            }
        });

        expect(membershipFromDb).not.toEqual(null);
    });

    test('should remove extra fields', async () => {
        const campaign = await generator.createCampaign({});
        const user = generator.generateUser({ superadmin: true });

        const res = await request({
            uri: '/signup/' + campaign.url,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: user
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body.superadmin).not.toEqual(true);
    });

    test('should send a mail to user', async () => {
        const campaign = await generator.createCampaign({});
        const user = generator.generateUser();

        const requestsMock = mock.mockAll({
            mailer: {
                body: (body) => body.to === user.email.toLowerCase()
            }
        });

        const res = await request({
            uri: '/signup/' + campaign.url,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: user
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(requestsMock.mailer.isDone()).toEqual(true);
    });

    test('should fail when mailer fails', async () => {
        mock.mockAll({ mailer: { netError: true } });

        const campaign = await generator.createCampaign({});
        const user = generator.generateUser();

        const res = await request({
            uri: '/signup/' + campaign.url,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: user
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });
});
