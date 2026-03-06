const helpers = require('../../lib/helpers');
const generator = require('../scripts/generator');
const { Event, Application } = require('../../models');

describe('Helpers and model contracts', () => {
    afterEach(async () => {
        await generator.clearAll();
    });

    test('should flatten nested objects without flattening dates', () => {
        const date = new Date('2026-03-06T12:00:00.000Z');
        const flattened = helpers.flattenObject({
            event: {
                name: 'Agora',
                schedule: {
                    starts: date
                }
            }
        });

        expect(flattened).toEqual({
            'event.name': 'Agora',
            'event.schedule.starts': date
        });
    });

    test('should detect numeric values consistently', () => {
        expect(helpers.isNumber(5)).toEqual(true);
        expect(helpers.isNumber('42')).toEqual(true);
        expect(helpers.isNumber('4.2')).toEqual(true);
        expect(helpers.isNumber('abc')).toEqual(false);
        expect(helpers.isNumber(false)).toEqual(false);
    });

    test('should reset and populate gauge data', () => {
        const gauge = {
            reset: jest.fn(),
            set: jest.fn()
        };

        helpers.addGaugeData(gauge, [
            { type: 'training', status: 'published', deleted: false, value: 2 },
            { event_name: 'Agora', status: 'accepted', body_name: 'AEGEE-Test', value: 1 }
        ]);

        expect(gauge.reset).toHaveBeenCalledTimes(1);
        expect(gauge.set).toHaveBeenNthCalledWith(1, { type: 'training', status: 'published', deleted: false }, 2);
        expect(gauge.set).toHaveBeenNthCalledWith(2, { event_name: 'Agora', status: 'accepted', body_name: 'AEGEE-Test' }, 1);
    });

    test('should build application export fields for custom questions', () => {
        const fields = helpers.getApplicationFields({
            questions: [
                { description: 'Why do you want to join?' },
                { description: 'What can you contribute?' }
            ]
        });

        expect(fields['answers.0']).toEqual('Answer 1: Why do you want to join?');
        expect(fields['answers.1']).toEqual('Answer 2: What can you contribute?');
    });

    test('should derive event permissions from core and approve permissions', () => {
        const permissions = helpers.getPermissions(
            { bodies: [{ id: 10 }, { id: 20 }] },
            [
                { combined: 'global:manage_event:training' },
                { combined: 'global:approve_event:conference' }
            ],
            [{ body_id: 20 }, { body_id: 20 }]
        );

        expect(permissions.manage_event.training).toEqual(true);
        expect(permissions.manage_event.conference).toEqual(false);
        expect(permissions.approve_event.conference).toEqual(true);
        expect(permissions.see_boardview[10]).toEqual(false);
        expect(permissions.see_boardview[20]).toEqual(true);
    });

    test('should create an event with valid nested payloads', async () => {
        const event = await Event.create(generator.generateEvent({
            name: 'Agora',
            locations: [{
                name: 'Main venue',
                position: { lat: 50.1, lng: 14.4 }
            }],
            questions: [{
                type: 'string',
                description: 'Tell us about yourself',
                required: true
            }]
        }));

        expect(event.name).toEqual('Agora');
        expect(event.locations).toHaveLength(1);
        expect(event.questions).toHaveLength(1);
    });

    test('should reject malformed event locations', async () => {
        await expect(Event.create(generator.generateEvent({
            locations: [{
                name: 'Main venue',
                position: { lat: '50.1', lng: 14.4 }
            }]
        }))).rejects.toHaveProperty('name', 'SequelizeValidationError');
    });

    test('should reject duplicate applications for the same event and user', async () => {
        const event = await generator.createEvent({ questions: [] });
        await generator.createApplication(event, {
            user_id: 7,
            answers: []
        });

        await expect(Application.create(generator.generateApplication(event, {
            user_id: 7,
            answers: []
        }))).rejects.toHaveProperty('name', 'SequelizeValidationError');
    });

    test('should reject attended applications that are not confirmed', async () => {
        const event = await generator.createEvent({ questions: [] });

        await expect(Application.create(generator.generateApplication(event, {
            confirmed: false,
            attended: true,
            answers: []
        }))).rejects.toHaveProperty('name', 'SequelizeValidationError');
    });
});
