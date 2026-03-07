jest.mock('../../lib/core', () => ({
    getAdminToken: jest.fn(),
    fetchUser: jest.fn(),
    fetchBody: jest.fn()
}));

jest.mock('../../lib/mailer', () => ({
    sendMail: jest.fn()
}));

jest.mock('../../lib/sequelize', () => ({
    Sequelize: { Op: {} },
    sequelize: {
        transaction: jest.fn(async (callback) => callback({}))
    }
}));

jest.mock('../../models', () => ({
    Application: { count: jest.fn() },
    Event: jest.fn(function Event(data) {
        Object.assign(this, data);
        this.save = jest.fn(async () => this);
        this.toJSON = jest.fn(() => ({ ...this }));
    })
}));

const events = require('../../lib/events');
const core = require('../../lib/core');
const mailer = require('../../lib/mailer');
const { Event } = require('../../models');

function createResponse() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    };
}

describe('Summer University editing regressions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        core.getAdminToken.mockResolvedValue('admin-token');
        core.fetchUser.mockImplementation(async (organizer) => ({
            ...organizer,
            notification_email: `user-${organizer.user_id}@aegee.test`
        }));
        core.fetchBody.mockImplementation(async (body) => body);
        mailer.sendMail.mockResolvedValue({ success: true });
    });

    test('uses the persisted event status for first-draft submissions', async () => {
        const res = createResponse();
        const event = {
            id: 7,
            status: 'first draft',
            organizers: [{ user_id: 1 }, { user_id: 2 }],
            update: jest.fn(async (data) => {
                Object.assign(event, data);
                return event;
            }),
            toJSON: jest.fn(() => ({ id: 7, status: event.status }))
        };

        await events.editEvent({
            body: { name: 'Updated SU' },
            event,
            permissions: {
                edit_summeruniversity: true,
                change_status: { first_submission: true }
            },
            headers: { 'x-auth-token': 'user-token' }
        }, res);

        expect(event.update).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'Updated SU',
                status: 'first submission'
            }),
            expect.any(Object)
        );
        expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: 7, status: 'first submission' } });
    });

    test('ignores application and open-call fields on generic event creation', async () => {
        const res = createResponse();

        await events.addEvent({
            body: {
                name: 'Created SU',
                organizers: [{ user_id: 1 }],
                open_call: true,
                max_participants: 50,
                accepted_participants: 20,
                application_starts: new Date('2026-01-01T00:00:00.000Z'),
                application_ends: new Date('2026-02-01T00:00:00.000Z')
            },
            permissions: { create_summeruniversity: true },
            user: { id: 1 },
            headers: { 'x-auth-token': 'user-token' }
        }, res);

        expect(Event).toHaveBeenCalledWith(expect.not.objectContaining({
            open_call: true,
            max_participants: 50,
            accepted_participants: 20,
            application_starts: expect.any(Date),
            application_ends: expect.any(Date)
        }));
        expect(Event).toHaveBeenCalledWith(expect.objectContaining({
            name: 'Created SU',
            status: 'first submission'
        }));
        expect(res.status).toHaveBeenCalledWith(201);
    });

    test('keeps using stored organizers when partial edits omit organizers', async () => {
        const res = createResponse();
        const event = {
            id: 8,
            status: 'approved',
            organizers: [{ user_id: 3 }, { user_id: 4 }],
            update: jest.fn(async (data) => {
                Object.assign(event, data);
                return event;
            }),
            toJSON: jest.fn(() => ({ id: 8, theme: event.theme }))
        };

        await events.editEvent({
            body: { theme: 'Updated theme' },
            event,
            permissions: {
                edit_summeruniversity: true,
                change_status: {}
            },
            headers: { 'x-auth-token': 'user-token' }
        }, res);

        expect(core.fetchUser).toHaveBeenCalledTimes(2);
        expect(mailer.sendMail).toHaveBeenCalledWith(expect.objectContaining({
            to: ['user-3@aegee.test', 'user-4@aegee.test'],
            subject: 'The event was updated'
        }));
        expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: 8, theme: 'Updated theme' } });
    });

    test('ignores application and open-call fields on generic event edits', async () => {
        const res = createResponse();
        const event = {
            id: 9,
            status: 'approved',
            organizers: [{ user_id: 3 }],
            update: jest.fn(async (data) => {
                Object.assign(event, data);
                return event;
            }),
            toJSON: jest.fn(() => ({ id: 9, title: event.title, open_call: event.open_call }))
        };

        await events.editEvent({
            body: {
                title: 'Updated title',
                open_call: true,
                max_participants: 100,
                accepted_participants: 90,
                application_ends: '2026-02-01T00:00:00.000Z'
            },
            event,
            permissions: {
                edit_summeruniversity: true,
                change_status: {}
            },
            headers: { 'x-auth-token': 'user-token' }
        }, res);

        expect(event.update).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'Updated title' }),
            expect.any(Object)
        );
        expect(event.update).not.toHaveBeenCalledWith(
            expect.objectContaining({
                open_call: true,
                max_participants: 100,
                accepted_participants: 90,
                application_ends: '2026-02-01T00:00:00.000Z'
            }),
            expect.any(Object)
        );
    });
});
