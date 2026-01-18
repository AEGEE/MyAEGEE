const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock');
const generator = require('../scripts/generator');

describe('Antenna Criteria', () => {
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

    test('should fail listing Antenna Criteria if no permission', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const res = await request({
            uri: '/antennaCriteria/1',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
    });

    test('should list all Antenna Criteria of the selected Agora', async () => {
        await generator.createAntennaCriterion({ agora_id: 1 });
        await generator.createAntennaCriterion({ agora_id: 1 });

        const res = await request({
            uri: '/antennaCriteria/1',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(2);
    });

    test('should only list Antenna Criteria of the selected Agora', async () => {
        await generator.createAntennaCriterion({ agora_id: 1 });
        await generator.createAntennaCriterion({ agora_id: 1 });
        await generator.createAntennaCriterion({ agora_id: 2 });

        const res = await request({
            uri: '/antennaCriteria/1',
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(2);
    });

    test('should fail creating new Antenna Criterion if no permission', async () => {
        mock.mockAll({ mainPermissions: { noPermissions: true } });

        const criterion = generator.generateAntennaCriterion();

        const res = await request({
            uri: '/antennaCriteria',
            method: 'PUT',
            body: criterion,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
    });

    // test('should fail creating new Antenna Criterion if the wrong permission', async () => {
    //     // TODO: Make incorrect permission

    //     const criterion = generator.generateAntennaCriterion({ antenna_criterion: 'fulfilment report' });

    //     const res = await request({
    //         uri: '/antennaCriteria',
    //         method: 'PUT',
    //         body: criterion,
    //         headers: { 'X-Auth-Token': 'blablabla' }
    //     });

    //     expect(res.statusCode).toEqual(403);
    //     expect(res.body.success).toEqual(false);
    // });

    // test('should fail giving `communication` exception if the wrong permission', async () => {
    //     // TODO: Make regular communication permission

    //     const criterion = generator.generateAntennaCriterion({ antenna_criterion: 'communication' });

    //     const res = await request({
    //         uri: '/antennaCriteria',
    //         method: 'PUT',
    //         body: criterion,
    //         headers: { 'X-Auth-Token': 'blablabla' }
    //     });

    //     expect(res.statusCode).toEqual(403);
    //     expect(res.body.success).toEqual(false);
    // });

    test('should fail creating new Antenna Criterion if agora_id is not set', async () => {
        const criterion = generator.generateAntennaCriterion({ agora_id: null });

        const res = await request({
            uri: '/antennaCriteria',
            method: 'PUT',
            body: criterion,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('agora_id');
    });

    test('should fail creating new Antenna Criterion if body_id is not set', async () => {
        const criterion = generator.generateAntennaCriterion({ body_id: null });

        const res = await request({
            uri: '/antennaCriteria',
            method: 'PUT',
            body: criterion,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('body_id');
    });

    test('should fail creating new Antenna Criterion if antenna_criterion is not set', async () => {
        const criterion = generator.generateAntennaCriterion({ antenna_criterion: null });

        const res = await request({
            uri: '/antennaCriteria',
            method: 'PUT',
            body: criterion,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
    });

    test('should fail creating new Antenna Criterion if antenna_criterion is not correct', async () => {
        const criterion = generator.generateAntennaCriterion({ antenna_criterion: 'blabla' });

        const res = await request({
            uri: '/antennaCriteria',
            method: 'PUT',
            body: criterion,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
    });

    test('should fail creating new Antenna Criterion if value is not correct', async () => {
        const criterion = generator.generateAntennaCriterion({ value: 'blabla' });

        const res = await request({
            uri: '/antennaCriteria',
            method: 'PUT',
            body: criterion,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body).not.toHaveProperty('data');
        expect(res.body.errors).toHaveProperty('value');
    });

    test('should create new Antenna Criterion if everything is okay', async () => {
        const criterion = generator.generateAntennaCriterion();

        const res = await request({
            uri: '/antennaCriteria',
            method: 'PUT',
            body: criterion,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data).toHaveProperty('agora_id');
        expect(res.body.data).toHaveProperty('body_id');
        expect(res.body.data).toHaveProperty('antenna_criterion');
    });

    test('should update Antenna Criterion if everything is okay', async () => {
        await generator.createAntennaCriterion({ agora_id: 1, body_id: 2, antenna_criterion: 'communication', value: 'false', comment: 'No communication' });
        const criterion = generator.generateAntennaCriterion({ agora_id: 1, body_id: 2, antenna_criterion: 'communication', value: 'true', comment: 'They are responding!' });

        const res = await request({
            uri: '/antennaCriteria',
            method: 'PUT',
            body: criterion,
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data).toHaveProperty('agora_id');
        expect(res.body.data.agora_id).toEqual(1);
        expect(res.body.data).toHaveProperty('body_id');
        expect(res.body.data.body_id).toEqual(2);
        expect(res.body.data).toHaveProperty('antenna_criterion');
        expect(res.body.data.antenna_criterion).toEqual('communication');
        expect(res.body.data).toHaveProperty('value');
        expect(res.body.data.value).toEqual('true');
        expect(res.body.data).toHaveProperty('comment');
        expect(res.body.data.comment).toEqual('They are responding!');
    });
});
