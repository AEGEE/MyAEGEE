const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const user = require('../assets/oms-core-valid').data;

describe('Events creation', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();

        await generator.clearAll();
    });

    it('should not create a new event if the is not a member of the body', async () => {
        mock.mockAll({ core: { notSuperadmin: true } });

        const res = await request({
            uri: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: {
                name: 'Develop Yourself 4',
                description: 'Test',
                application_starts: '2017-12-05 15:00',
                application_ends: '2017-12-05 15:00',
                starts: '2017-12-11 15:00',
                ends: '2017-12-14 12:00',
                type: 'es',
                body_id: 1337
            }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should not create a new event if body_id is not provided', async () => {
        mock.mockAll({ core: { notSuperadmin: true } });

        const res = await request({
            uri: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: {
                name: 'Develop Yourself 4',
                description: 'Test',
                application_starts: '2017-12-05 15:00',
                application_ends: '2017-12-05 15:00',
                starts: '2017-12-11 15:00',
                ends: '2017-12-14 12:00',
                type: 'es'
            }
        });

        expect(res.statusCode).toEqual(403);

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should create a new event on minimal sane / POST', async () => {
        const res = await request({
            uri: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: {
                name: 'Develop Yourself 4',
                description: 'Test',
                application_starts: '2017-12-03 15:00',
                application_ends: '2017-12-05 15:00',
                starts: '2017-12-11 15:00',
                ends: '2017-12-14 12:00',
                type: 'es',
                body_id: user.bodies[0].id
            }
        });

        expect(res.statusCode).toEqual(201);

        expect(res.body.success).toEqual(true);
        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data).toHaveProperty('name');
        expect(res.body.data).toHaveProperty('application_starts');
        expect(res.body.data).toHaveProperty('application_ends');
        expect(res.body.data).toHaveProperty('starts');
        expect(res.body.data).toHaveProperty('ends');
        expect(res.body.data).toHaveProperty('application_status');
        expect(res.body.data).toHaveProperty('status');
        expect(res.body.data).toHaveProperty('type');
        expect(res.body.data).toHaveProperty('organizing_bodies');
        expect(res.body.data).toHaveProperty('description');
        expect(res.body.data).toHaveProperty('questions');
        expect(res.body.data).toHaveProperty('organizers');

    // Check auto-filled fields
        expect(res.body.data.status).toEqual('draft');
        expect(res.body.data.application_status).toEqual('closed');
        expect(res.body.data.questions.length).toEqual(0);
    });

    it('should create a new event on exhausive sane / POST', async () => {
        const res = await request({
            uri: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: {
                name: 'Develop Yourself 4',
                application_starts: '2017-12-05 13:00',
                application_ends: '2017-12-05 15:00',
                starts: '2017-12-11 15:00',
                ends: '2017-12-14 12:00',
                type: 'es',
                description: 'A training event to boost your self-confidence and teamworking skills',
                max_participants: 22,
                questions: [
                    {
                        name: 'What is the greatest local',
                        description: 'Really',
                        type: 'string',
                        required: false
                    },
                    {
                        name: 'What is the meaning of life',
                        description: '42?',
                        type: 'string',
                        required: false
                    },
                ],
                body_id: user.bodies[0].id
            }
        });

        expect(res.statusCode).toEqual(201);

        expect(res.body.success).toEqual(true);
        expect(res.body.data).toHaveProperty('id');
        expect(res.body.data).toHaveProperty('name');
        expect(res.body.data).toHaveProperty('starts');
        expect(res.body.data).toHaveProperty('ends');
        expect(res.body.data).toHaveProperty('application_status');
        expect(res.body.data).toHaveProperty('status');
        expect(res.body.data).toHaveProperty('type');
        expect(res.body.data).toHaveProperty('organizing_bodies');
        expect(res.body.data).toHaveProperty('max_participants');
        expect(res.body.data).toHaveProperty('description');
        expect(res.body.data).toHaveProperty('questions');
        expect(res.body.data).toHaveProperty('organizers');

        expect(res.body.data.questions.length).toEqual(2);

        expect(res.body.data.organizers.length).toEqual(1);
        expect(res.body.data.organizing_bodies.length).toEqual(1);
    });

    it('should discart superflous fields on overly detailed / POST', async () => {
        const res = await request({
            uri: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: {
                name: 'Develop Yourself 4',
                description: 'A training event to boost your self-confidence and teamworking skills',
                application_starts: '2017-12-05 13:00',
                application_ends: '2017-12-05 15:00',
                starts: '2017-12-11 15:00',
                ends: '2017-12-14 12:00',
                type: 'es',
                organizers: [
                    {
                        user_id: 3,
                        first_name: 'test',
                        last_name: 'test',
                        role: 'full',
                    },
                ],
                applications: [
                    {
                        user_id: 5,
                        body_id: 10,
                        status: 'accepted',
                    },
                ],
                body_id: user.bodies[0].id
            }
        });

        expect(res.statusCode).toEqual(201);

        expect(res.body.data.organizers.length).toEqual(1);
        expect(res.body.data.organizers[0].user_id).not.toEqual(3);
    });

    it('should return validation errors on malformed / POST', async () => {
        const res = await request({
            uri: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: {
                starts: '2015-12-11 15:00',
                ends: 'sometime, dunno yet',
                type: 'non-statutory',
                body_id: user.bodies[0].id,
                fee: -150
            }
        });

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('ends');
        expect(res.body.errors).toHaveProperty('name');
        expect(res.body.errors).toHaveProperty('fee');
    });

    it('should return 422 if the locations is not an array', async () => {
        const event = generator.generateEvent({ body_id: user.bodies[0].id });
        event.locations = false;

        const res = await request({
            uri: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('locations');
    });

    it('should return 422 if the location is not an object', async () => {
        const event = generator.generateEvent({ body_id: user.bodies[0].id });
        event.locations = [false];

        const res = await request({
            uri: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('locations');
    });

    it('should return 422 if the location is null', async () => {
        const event = generator.generateEvent({ body_id: user.bodies[0].id });
        event.locations = [null];

        const res = await request({
            uri: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('locations');
    });

    it('should return 422 if the location\'s name is not set or invalid', async () => {
        const event = generator.generateEvent({ body_id: user.bodies[0].id });
        event.locations = [{ name: null, position: { lat: 1, lng: 1 } }];

        const res = await request({
            uri: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('locations');
    });

    it('should return 422 if the location\'s name is empty', async () => {
        const event = generator.generateEvent({ body_id: user.bodies[0].id });
        event.locations = [{ name: '', position: { lat: 1, lng: 1 } }];

        const res = await request({
            uri: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('locations');
    });

    it('should return 422 if the location\'s object is not an object', async () => {
        const event = generator.generateEvent({ body_id: user.bodies[0].id });
        event.locations = [{ name: 'test', position: false }];

        const res = await request({
            uri: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('locations');
    });

    it('should return 422 if the location\'s object is null', async () => {
        const event = generator.generateEvent({ body_id: user.bodies[0].id });
        event.locations = [{ name: 'test', position: null }];

        const res = await request({
            uri: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('locations');
    });

    it('should return 422 if the location\'s latitude is not set', async () => {
        const event = generator.generateEvent({ body_id: user.bodies[0].id });
        event.locations = [{ name: 'test', position: { lat: false, lng: 1 } }];

        const res = await request({
            uri: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('locations');
    });

    it('should return 422 if the location\'s longitude is not set', async () => {
        const event = generator.generateEvent({ body_id: user.bodies[0].id });
        event.locations = [{ name: 'test', position: { lat: 1, lng: false } }];

        const res = await request({
            uri: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('locations');
    });

    it('should return 200 if the location is ok', async () => {
        const event = generator.generateEvent({ body_id: user.bodies[0].id });
        event.locations = [{ name: 'test', position: { lat: 1, lng: 1 } }];

        const res = await request({
            uri: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(201);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
    });

    it('should return 422 if application period ends after it starts', async () => {
        const event = generator.generateEvent({
            body_id: user.bodies[0].id,
            application_starts: moment().subtract(1, 'week').toDate(),
            application_ends: moment().subtract(2, 'week').toDate()
        });

        const res = await request({
            uri: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('application_ends');
    });

    it('should return 422 if the event ends after it starts', async () => {
        const event = generator.generateEvent({
            body_id: user.bodies[0].id,
            application_starts: moment().subtract(4, 'week').toDate(),
            application_ends: moment().subtract(3, 'week').toDate(),
            starts: moment().subtract(1, 'week').toDate(),
            ends: moment().subtract(2, 'week').toDate()
        });

        const res = await request({
            uri: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('ends');
    });

    it('should return 422 if the event starts before application period ends', async () => {
        const event = generator.generateEvent({
            body_id: user.bodies[0].id,
            application_starts: moment().subtract(4, 'week').toDate(),
            application_ends: moment().subtract(2, 'week').toDate(),
            starts: moment().subtract(3, 'week').toDate(),
            ends: moment().subtract(1, 'week').toDate()
        });

        const res = await request({
            uri: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('application_ends');
    });

    it('should return 422 if questions is not an array', async () => {
        const event = generator.generateEvent({
            body_id: user.bodies[0].id,
            questions: false
        });

        const res = await request({
            uri: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('questions');
    });

    it('should return 422 if question is not an object', async () => {
        const event = generator.generateEvent({
            body_id: user.bodies[0].id,
            questions: [false]
        });

        const res = await request({
            uri: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('questions');
    });

    it('should return 422 if question.description is not a string', async () => {
        const event = generator.generateEvent({
            body_id: user.bodies[0].id,
            questions: [{ description: false }]
        });

        const res = await request({
            uri: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('questions');
    });

    it('should return 422 if question.description is empty', async () => {
        const event = generator.generateEvent({
            body_id: user.bodies[0].id,
            questions: [{ description: '' }]
        });

        const res = await request({
            uri: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('questions');
    });

    it('should return 422 if question.type is not a string', async () => {
        const event = generator.generateEvent({
            body_id: user.bodies[0].id,
            questions: [{ description: 'test', type: false }]
        });

        const res = await request({
            uri: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('questions');
    });

    it('should return 422 if question.required is not a boolean', async () => {
        const event = generator.generateEvent({
            body_id: user.bodies[0].id,
            questions: [{ description: 'test', type: 'checkbox', required: 'test' }]
        });

        const res = await request({
            uri: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('questions');
    });

    it('should return 422 if question.type = select and values is not an array', async () => {
        const event = generator.generateEvent({
            body_id: user.bodies[0].id,
            questions: [{ description: 'test', type: 'select', required: true, values: false }]
        });

        const res = await request({
            uri: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('questions');
    });

    it('should return 422 if question.type = select and values has value that is not a string', async () => {
        const event = generator.generateEvent({
            body_id: user.bodies[0].id,
            questions: [{ description: 'test', type: 'select', required: true, values: [false] }]
        });

        const res = await request({
            uri: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('questions');
    });

    it('should return 422 if question.type = select and values has value that is empty', async () => {
        const event = generator.generateEvent({
            body_id: user.bodies[0].id,
            questions: [{ description: 'test', type: 'select', required: true, values: [''] }]
        });

        const res = await request({
            uri: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('questions');
    });

    it('should return 422 if question.type = select and values are okay', async () => {
        const event = generator.generateEvent({
            body_id: user.bodies[0].id,
            questions: [{ description: 'test', type: 'select', required: true, values: ['test'] }]
        });

        const res = await request({
            uri: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(201);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');
    });

    it('should return 422 if question.type is invalid', async () => {
        const event = generator.generateEvent({
            body_id: user.bodies[0].id,
            questions: [{ description: 'test', type: 'nonexistant', required: true }]
        });

        const res = await request({
            uri: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('questions');
    });
});
