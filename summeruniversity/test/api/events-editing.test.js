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
    Application: {},
    Event: {}
}));

const events = require('../../lib/events');
const core = require('../../lib/core');
const mailer = require('../../lib/mailer');

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
});
