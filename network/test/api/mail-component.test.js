const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock');
const generator = require('../scripts/generator');

describe('MailComponent', () => {
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

    test('should fail listing MailComponents if no permission', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const res = await request({
            uri: '/mailComponent/1',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
    });

    test('should list MailComponents of the selected Agora', async () => {
        await generator.createMailComponent({ agora_id: 1, mail_component: 'introduction' });
        await generator.createMailComponent({ agora_id: 1, mail_component: 'communication' });

        const res = await request({
            uri: '/mailComponent/1',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(2);
    });

    test('should only list MailComponents of the selected Agora', async () => {
        await generator.createMailComponent({ agora_id: 1, mail_component: 'introduction' });
        await generator.createMailComponent({ agora_id: 1, mail_component: 'communication' });
        await generator.createMailComponent({ agora_id: 2, mail_component: 'board election' });

        const res = await request({
            uri: '/mailComponent/1',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(2);
    });

    test('should fail creating new MailComponent if no permission', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const component = generator.generateMailComponent();

        const res = await request({
            uri: '/mailComponent',
            method: 'PUT',
            body: component,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
    });

    test('should fail creating new MailComponent if agora_id is not set', async () => {
        const component = generator.generateMailComponent({ agora_id: null });

        const res = await request({
            uri: '/mailComponent',
            method: 'PUT',
            body: component,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('agora_id');
    });

    test('should fail creating new MailComponent if mail_component is not set', async () => {
        const component = generator.generateMailComponent({ mail_component: null });

        const res = await request({
            uri: '/mailComponent',
            method: 'PUT',
            body: component,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body.message).toEqual('This is not a valid mail component.');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should fail creating new MailComponent if mail_component is not correct', async () => {
        const component = generator.generateMailComponent({ mail_component: 'blabla' });

        const res = await request({
            uri: '/mailComponent',
            method: 'PUT',
            body: component,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
    });

    test('should fail creating new MailComponent if text is not set', async () => {
        const component = generator.generateMailComponent({ text: null });

        const res = await request({
            uri: '/mailComponent',
            method: 'PUT',
            body: component,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('text');
    });

    test('should create new MailComponent if everything is okay', async () => {
        const component = generator.generateMailComponent();

        const res = await request({
            uri: '/mailComponent',
            method: 'PUT',
            body: component,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data).toHaveProperty('agora_id');
        expect(res.body.data).toHaveProperty('mail_component');
        expect(res.body.data).toHaveProperty('text');
    });

    test('should update existing MailComponent if everything is okay', async () => {
        await generator.createMailComponent({ agora_id: 1, mail_component: 'introduction', text: 'Hello!' });
        const component = generator.generateMailComponent({ agora_id: 1, mail_component: 'introduction', text: 'Goodbye!' });

        const res = await request({
            uri: '/mailComponent',
            method: 'PUT',
            body: component,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data).toHaveProperty('agora_id');
        expect(res.body.data.agora_id).toEqual(1);
        expect(res.body.data).toHaveProperty('mail_component');
        expect(res.body.data.mail_component).toEqual('introduction');
        expect(res.body.data).toHaveProperty('text');
        expect(res.body.data.text).toEqual('Goodbye!');
    });
});
