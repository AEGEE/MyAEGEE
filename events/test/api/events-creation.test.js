const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const user = require('../assets/oms-core-valid.json').data;

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
                type: 'cultural',
                organizing_bodies: [{ body_id: user.bodies[0].id }],
                organizers: [{ user_id: user.id }],
                meals_per_day: 2,
                accommodation_type: 'ritz hotel',
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
        expect(res.body.data).toHaveProperty('meals_per_day');
        expect(res.body.data).toHaveProperty('accommodation_type');
        expect(res.body.data).toHaveProperty('optional_programme');
        expect(res.body.data).toHaveProperty('optional_fee');
        expect(res.body.data).toHaveProperty('link_info_travel_country');

        // Check auto-filled fields
        expect(res.body.data.status).toEqual('draft');
        expect(res.body.data.application_status).toEqual('closed');
        expect(res.body.data.questions.length).toEqual(0);
    });

    it('should create a new event on exhaustive sane / POST', async () => {
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
                type: 'cultural',
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
                organizers: [{ user_id: user.id }],
                organizing_bodies: [{ body_id: user.bodies[0].id }],
                meals_per_day: 0,
                accommodation_type: 'ritz hotel',
                optional_programme: 'visit of the joke factory',
                optional_fee: 21.45,
                link_info_travel_country: 'https://en.wikipedia.org/wiki/Human_mission_to_Mars'
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
        expect(res.body.data).toHaveProperty('meals_per_day');
        expect(res.body.data).toHaveProperty('accommodation_type');
        expect(res.body.data).toHaveProperty('optional_programme');
        expect(res.body.data).toHaveProperty('optional_fee');
        expect(res.body.data).toHaveProperty('link_info_travel_country');

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
                type: 'cultural',
                organizers: [{ user_id: user.id }],
                organizing_bodies: [{ body_id: user.bodies[0].id }],
                accommodation_type: 'camping',
                meals_per_day: 2,
                status: 'published'
            }
        });

        expect(res.statusCode).toEqual(201);

        expect(res.body.data.status).not.toEqual('published');
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
                organizers: [{ user_id: user.id }],
                organizing_bodies: [{ body_id: user.bodies[0].id }],
                fee: -150,
                meals_per_day: 5,
                optional_fee: 'string',
            }
        });

        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('ends');
        expect(res.body.errors).toHaveProperty('name');
        expect(res.body.errors).toHaveProperty('fee');
        expect(res.body.errors).toHaveProperty('type');
        expect(res.body.errors).toHaveProperty('description');
        expect(res.body.errors).toHaveProperty('application_ends');
        expect(res.body.errors).toHaveProperty('application_starts');
        expect(res.body.errors).toHaveProperty('optional_fee');
        expect(res.body.errors).toHaveProperty('meals_per_day');
        expect(res.body.errors).toHaveProperty('accommodation_type');
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

    it('should fail is the event creator is not an organizer', async () => {
        const event = generator.generateEvent({ organizers: [{ user_id: 1337 }] });
        event.locations = false;

        const res = await request({
            uri: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should fail is core request returns net error', async () => {
        mock.mockAll({ member: { netError: true } });
        const event = generator.generateEvent({ organizers: [{ user_id: user.id }] });
        event.locations = false;

        const res = await request({
            uri: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should fail is core request returns garbage', async () => {
        mock.mockAll({ member: { badResponse: true } });
        const event = generator.generateEvent({ organizers: [{ user_id: user.id }] });
        event.locations = false;

        const res = await request({
            uri: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should fail is core request returns unsuccessful response', async () => {
        mock.mockAll({ member: { unsuccessfulResponse: true } });
        const event = generator.generateEvent({ organizers: [{ user_id: user.id }] });
        event.locations = false;

        const res = await request({
            uri: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
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
            organizing_bodies: [{ body_id: user.bodies[0].id }],
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
            organizing_bodies: [{ body_id: user.bodies[0].id }],
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
            organizing_bodies: [{ body_id: user.bodies[0].id }],
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
            organizing_bodies: [{ body_id: user.bodies[0].id }],
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
            organizing_bodies: [{ body_id: user.bodies[0].id }],
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
            organizing_bodies: [{ body_id: user.bodies[0].id }],
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
            organizing_bodies: [{ body_id: user.bodies[0].id }],
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
            organizing_bodies: [{ body_id: user.bodies[0].id }],
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
            organizing_bodies: [{ body_id: user.bodies[0].id }],
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
            organizing_bodies: [{ body_id: user.bodies[0].id }],
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
            organizing_bodies: [{ body_id: user.bodies[0].id }],
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
            organizing_bodies: [{ body_id: user.bodies[0].id }],
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

    it('should return 200 if question.type = select and values are okay', async () => {
        const event = generator.generateEvent({
            organizing_bodies: [{ body_id: user.bodies[0].id }],
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
            organizing_bodies: [{ body_id: user.bodies[0].id }],
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

    it('should return 200 if the fee is float', async () => {
        const event = generator.generateEvent({ fee: 50.45 });
        event.body_id = user.bodies[0].id;

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

    it('should return 200 if the optional fee is int', async () => {
        const event = generator.generateEvent({ optional_fee: 12 });
        event.body_id = user.bodies[0].id;

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

    it('should return 422 if URL is invalid', async () => {
        const event = generator.generateEvent({
            organizing_bodies: [{ body_id: user.bodies[0].id }],
            url: 'http://test.eu hello'
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
        expect(res.body.errors).toHaveProperty('url');
    });

    it('should return 422 if URL contains numbers only', async () => {
        const event = generator.generateEvent({
            organizing_bodies: [{ body_id: user.bodies[0].id }],
            url: '12345'
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
        expect(res.body.errors).toHaveProperty('url');
    });

    it('should return 422 if URL is not unique', async () => {
        await generator.createEvent({ url: 'non-unique-url' });

        const event = generator.generateEvent({
            organizing_bodies: [{ body_id: user.bodies[0].id }],
            url: 'non-unique-URL'
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
        expect(res.body.errors).toHaveProperty('url');
    });

    it('should return 200 if URL is valid', async () => {
        const event = generator.generateEvent({
            organizing_bodies: [{ body_id: user.bodies[0].id }],
            url: 'some-valid-url'
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

    it('should return 422 if organizing_bodies is not an array', async () => {
        const event = generator.generateEvent({
            organizing_bodies: false
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
        expect(res.body.errors).toHaveProperty('organizing_bodies');
    });

    it('should return 422 if organizing_bodies is empty', async () => {
        const event = generator.generateEvent({
            organizing_bodies: []
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
        expect(res.body.errors).toHaveProperty('organizing_bodies');
    });

    it('should return 422 if organizing_bodies.body is not an object', async () => {
        const event = generator.generateEvent({
            organizing_bodies: [false]
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
        expect(res.body.errors).toHaveProperty('organizing_bodies');
    });

    it('should return 422 if organizing_bodies[].body_id is not a number', async () => {
        const event = generator.generateEvent({
            organizing_bodies: [{ body_id: false }]
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
        expect(res.body.errors).toHaveProperty('organizing_bodies');
    });

    it('should fail if body request returns net error', async () => {
        mock.mockAll({ body: { netError: true } });
        const event = generator.generateEvent();

        const res = await request({
            uri: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
    });

    it('should fail if body request returns bad response', async () => {
        mock.mockAll({ body: { badResponse: true } });
        const event = generator.generateEvent();

        const res = await request({
            uri: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
    });

    it('should fail if body request returns unsuccessful response', async () => {
        mock.mockAll({ body: { unsuccessfulResponse: true } });
        const event = generator.generateEvent();

        const res = await request({
            uri: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(500);
        expect(res.body.success).toEqual(false);
    });

    it('should return an error if organizers is not an array', async () => {
        const event = generator.generateEvent({ organizers: false });
        event.locations = false;

        const res = await request({
            uri: '/',
            headers: { 'X-Auth-Token': 'foobar' },
            method: 'POST',
            body: event
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body.errors).toHaveProperty('organizers');
    });

    it('should return an error if body name is not a string', async () => {
        try {
            await generator.createEvent({
                organizing_bodies: [{ body_id: 3, body_name: false }]
            });
            expect(1).toEqual(0);
        } catch (err) {
            expect(1).toEqual(1);
        }
    });

    it('should return an error if body name is empty', async () => {
        try {
            await generator.createEvent({
                organizing_bodies: [{ body_id: 3, body_name: '\t\t  \t' }]
            });
            expect(1).toEqual(0);
        } catch (err) {
            expect(1).toEqual(1);
        }
    });
});
