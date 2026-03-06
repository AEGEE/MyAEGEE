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
                name: 'Summer University',
                schedule: { starts: date }
            }
        });

        expect(flattened).toEqual({
            'event.name': 'Summer University',
            'event.schedule.starts': date
        });
    });

    test('should count values by field', () => {
        const counted = helpers.countByField([
            { status: 'accepted' },
            { status: 'accepted' },
            { status: 'pending' }
        ], 'status');

        expect(counted).toEqual([
            { type: 'accepted', value: 2 },
            { type: 'pending', value: 1 }
        ]);
    });

    test('should derive SU permissions from core and board permissions', () => {
        const permissions = helpers.getPermissions(
            { bodies: [{ id: 10 }, { id: 20 }] },
            [
                { combined: 'global:create:summeruniversity' },
                { combined: 'global:apply:summeruniversity' },
                { combined: 'global:manage_summeruniversity:regular' }
            ],
            [{ body_id: 20 }]
        );

        expect(permissions.create_summeruniversity).toEqual(true);
        expect(permissions.apply_general).toEqual(true);
        expect(permissions.manage_summeruniversity.regular).toEqual(true);
        expect(permissions.see_boardview[10]).toEqual(false);
        expect(permissions.see_boardview[20]).toEqual(true);
    });

    test('should create a summer university with valid nested payloads', async () => {
        const event = await Event.create(generator.generateEvent({
            name: 'SU Test',
            questions: [{ description: 'Why?', type: 'text', required: true }]
        }));

        expect(event.name).toEqual('SU Test');
        expect(event.organizers).toHaveLength(4);
        expect(event.locations).toHaveLength(1);
    });

    test('should reject SU events with too few organizers', async () => {
        await expect(Event.create(generator.generateEvent({
            organizers: [{ user_id: 1, body_id: 1, role: 'main_coordinator' }]
        }))).rejects.toHaveProperty('name', 'SequelizeValidationError');
    });

    test('should reject duplicate applications for the same SU and user', async () => {
        const event = await generator.createEvent({ questions: [] });
        await generator.createApplication(event, { user_id: 7, answers: [] });

        await expect(Application.create(generator.generateApplication(event, {
            user_id: 7,
            answers: []
        }))).rejects.toHaveProperty('name', 'SequelizeValidationError');
    });

    test('should require visa details when visa is required', async () => {
        const event = await generator.createEvent({ questions: [] });

        await expect(Application.create(generator.generateApplication(event, {
            visa_required: true,
            answers: []
        }))).rejects.toHaveProperty('name', 'SequelizeValidationError');
    });
});
