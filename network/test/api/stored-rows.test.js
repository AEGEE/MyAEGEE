const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock');
const generator = require('../scripts/generator');

// Create and update handlers answer with the row as stored, so an ID sent as a numeric
// string comes back as a number.
const BODY_ID = 34;

describe('Stored rows in answers', () => {
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

    test('createBoard', async () => {
        const res = await request({
            path: '/bodies/' + BODY_ID + '/boards',
            method: 'POST',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: generator.generateBoard({ body_id: BODY_ID, president: '7', secretary: '8', treasurer: '9', image_id: '3' })
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data).toMatchObject({ body_id: BODY_ID, president: 7, secretary: 8, treasurer: 9, image_id: 3 });
    });

    test('updateBoard', async () => {
        const board = await generator.createBoard({ body_id: BODY_ID });

        const res = await request({
            path: '/bodies/' + BODY_ID + '/boards/' + board.id,
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { president: '7', image_id: '3', start_date: '2026-01-10T16:00:00.000Z' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data).toMatchObject({ id: board.id, president: 7, image_id: 3, start_date: '2026-01-10' });
    });

    test('setAntennaCriterion', async () => {
        const res = await request({
            path: '/antennaCriteria',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { agora_id: '5', body_id: String(BODY_ID), antenna_criterion: 'events', value: 'true' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data).toMatchObject({ agora_id: 5, body_id: BODY_ID, antenna_criterion: 'events', value: 'true' });
    });

    test('setNetcomAssignment', async () => {
        const res = await request({
            path: '/netcom',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { body_id: String(BODY_ID), netcom_id: '6' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data).toMatchObject({ body_id: BODY_ID, netcom_id: 6 });
    });

    test('setMailComponent', async () => {
        const res = await request({
            path: '/mailComponent',
            method: 'PUT',
            headers: { 'X-Auth-Token': 'blablabla' },
            body: { agora_id: '5', mail_component: 'closing', text: 'Text' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data).toMatchObject({ agora_id: 5, mail_component: 'closing', text: 'Text' });
    });
});
