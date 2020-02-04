const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');

describe('Campaign submission', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should fail if the campaign is not found', async () => {
        const user = generator.generateUser();

        const res = await request({
            uri: '/campaigns/asdasdas',
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
            uri: '/campaigns/' + campaign.url,
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
        const user = generator.generateUser({ username: 'not valid username '});

        const res = await request({
            uri: '/campaigns/' + campaign.url,
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
        const user = generator.generateUser({ first_name: '!@#!@#D'});

        const res = await request({
            uri: '/campaigns/' + campaign.url,
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
        const user = generator.generateUser({ last_name: '!@#!@#D'});

        const res = await request({
            uri: '/campaigns/' + campaign.url,
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
            uri: '/campaigns/' + campaign.url,
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
            uri: '/campaigns/' + campaign.url,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: user
        });

        console.log(res.body);

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
            uri: '/campaigns/' + campaign.url,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: user
        });

        console.log(res.body);

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
            uri: '/campaigns/' + campaign.url,
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: user
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
    });
});
