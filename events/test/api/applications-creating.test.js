const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const user = require('../assets/oms-core-valid.json').data;

describe('Events application creating', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();

        await generator.clearAll();
    });

    it('should disallow application for events with closed deadline', async () => {
        const event = await generator.createEvent({
            application_starts: moment().subtract(2, 'weeks').toDate(),
            application_ends: moment().subtract(1, 'week').toDate(),
            status: 'published',
            questions: [],
            applications: []
        });

        const res = await request({
            uri: '/single/' + event.id + '/applications',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: { body_id: user.bodies[0].id }
        });

        expect(res.statusCode).toEqual(403);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should not add the application if the person is not a member of a body', async () => {
        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            applications: [],
            questions: [{
                type: 'string',
                name: 'test',
                description: 'test',
                required: true
            }]
        });

        const res = await request({
            uri: '/single/' + event.id + '/applications',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: {
                body_id: 1337,
                answers: ['test'],
                agreed_to_privacy_policy: true
            }
        });

        expect(res.statusCode).toEqual(400);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should return 422 if agreed_to_privacy_policy = false', async () => {
        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            applications: [],
            questions: []
        });

        const res = await request({
            uri: '/single/' + event.id + '/applications',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: {
                body_id: user.bodies[0].id,
                answers: [],
                agreed_to_privacy_policy: false
            }
        });

        expect(res.statusCode).toEqual(422);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('agreed_to_privacy_policy');
    });

    it('should return 422 if answers is not an array', async () => {
        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            applications: [],
            questions: [{
                type: 'checkbox',
                description: 'test',
                required: true
            }]
        });

        const res = await request({
            uri: '/single/' + event.id + '/applications',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: {
                body_id: user.bodies[0].id,
                answers: false,
                agreed_to_privacy_policy: true
            }
        });

        expect(res.statusCode).toEqual(422);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('answers');
    });

    it('should return 422 if answer number mismatch questions number', async () => {
        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            questions: [{
                type: 'checkbox',
                description: 'test',
                required: true
            }]
        });

        const res = await request({
            uri: '/single/' + event.id + '/applications',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: {
                body_id: user.bodies[0].id,
                answers: [],
                agreed_to_privacy_policy: true
            }
        });

        expect(res.statusCode).toEqual(422);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('answers');
    });

    it('should return 422 if question.type = string, but answer is not a string', async () => {
        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            questions: [{
                type: 'string',
                description: 'test',
                required: true
            }]
        });

        const res = await request({
            uri: '/single/' + event.id + '/applications',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: {
                body_id: user.bodies[0].id,
                answers: [false],
                agreed_to_privacy_policy: true
            }
        });

        expect(res.statusCode).toEqual(422);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('answers');
    });

    it('should return 422 if question.type = text, but answer is not a string', async () => {
        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            questions: [{
                type: 'text',
                description: 'test',
                required: true
            }]
        });

        const res = await request({
            uri: '/single/' + event.id + '/applications',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: {
                body_id: user.bodies[0].id,
                answers: [false],
                agreed_to_privacy_policy: true
            }
        });

        expect(res.statusCode).toEqual(422);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('answers');
    });

    it('should return 422 if question.type = string, but answer is empty', async () => {
        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            questions: [{
                type: 'string',
                description: 'test',
                required: true
            }]
        });

        const res = await request({
            uri: '/single/' + event.id + '/applications',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: {
                body_id: user.bodies[0].id,
                answers: [''],
                agreed_to_privacy_policy: true
            }
        });

        expect(res.statusCode).toEqual(422);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('answers');
    });

    it('should return 422 if question.type = text, but answer is not a string', async () => {
        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            questions: [{
                type: 'text',
                description: 'test',
                required: true
            }]
        });

        const res = await request({
            uri: '/single/' + event.id + '/applications',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: {
                body_id: user.bodies[0].id,
                answers: [''],
                agreed_to_privacy_policy: true
            }
        });

        expect(res.statusCode).toEqual(422);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('answers');
    });

    it('should return 422 if question.type = number, but answer is not a number', async () => {
        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            questions: [{
                type: 'number',
                description: 'test',
                required: true
            }]
        });

        const res = await request({
            uri: '/single/' + event.id + '/applications',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: {
                body_id: user.bodies[0].id,
                answers: [false],
                agreed_to_privacy_policy: true
            }
        });

        expect(res.statusCode).toEqual(422);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('answers');
    });

    it('should return 200 if question.type = number, but answer is a number', async () => {
        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            questions: [{
                type: 'number',
                description: 'test',
                required: true
            }]
        });

        const res = await request({
            uri: '/single/' + event.id + '/applications',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: {
                body_id: user.bodies[0].id,
                answers: [1],
                agreed_to_privacy_policy: true
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('answers');
    });

    it('should return 422 if question.type = select, but answer is not in values', async () => {
        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            questions: [{
                type: 'select',
                description: 'test',
                required: true,
                values: ['first']
            }]
        });

        const res = await request({
            uri: '/single/' + event.id + '/applications',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: {
                body_id: user.bodies[0].id,
                answers: ['second'],
                agreed_to_privacy_policy: true
            }
        });

        expect(res.statusCode).toEqual(422);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('answers');
    });

    it('should return 200 if question.type = select, but answer is in values', async () => {
        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            questions: [{
                type: 'select',
                description: 'test',
                required: true,
                values: ['first', 'second']
            }]
        });

        const res = await request({
            uri: '/single/' + event.id + '/applications',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: {
                body_id: user.bodies[0].id,
                answers: ['first'],
                agreed_to_privacy_policy: true
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('answers');
    });

    it('should return 422 if question.type = checkbox, but answer is not a boolean', async () => {
        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            questions: [{
                type: 'checkbox',
                description: 'test',
                required: true
            }]
        });

        const res = await request({
            uri: '/single/' + event.id + '/applications',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: {
                body_id: user.bodies[0].id,
                answers: ['second'],
                agreed_to_privacy_policy: true
            }
        });

        expect(res.statusCode).toEqual(422);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('answers');
    });

    it('should return 422 if question.type = checkbox and is required, but answer is not true', async () => {
        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            questions: [{
                type: 'checkbox',
                description: 'test',
                required: true
            }]
        });

        const res = await request({
            uri: '/single/' + event.id + '/applications',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: {
                body_id: user.bodies[0].id,
                answers: [false],
                agreed_to_privacy_policy: true
            }
        });

        expect(res.statusCode).toEqual(422);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('answers');
    });

    it('should return 200 if question.type = checkbox, but answer is boolean', async () => {
        const event = await generator.createEvent({
            application_starts: moment().subtract(1, 'weeks').toDate(),
            application_ends: moment().add(1, 'week').toDate(),
            status: 'published',
            questions: [{
                type: 'checkbox',
                description: 'test',
                required: true
            }]
        });

        const res = await request({
            uri: '/single/' + event.id + '/applications',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: {
                body_id: user.bodies[0].id,
                answers: [true],
                agreed_to_privacy_policy: true
            }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('answers');
    });
});
