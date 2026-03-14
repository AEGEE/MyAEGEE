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

const mockEventFactory = jest.fn();

jest.mock('../../models', () => ({
    Application: {},
    Event: function Event(data) {
        return mockEventFactory(data);
    }
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

describe('Summer University season defaults', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers().setSystemTime(new Date('2027-04-15T12:00:00.000Z'));

        core.getAdminToken.mockResolvedValue('admin-token');
        core.fetchUser.mockImplementation(async (organizer) => ({
            ...organizer,
            notification_email: `user-${organizer.user_id}@aegee.test`
        }));
        core.fetchBody.mockImplementation(async (body) => body);
        mailer.sendMail.mockResolvedValue({ success: true });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('defaults new event seasons to the current year', async () => {
        const res = createResponse();
        const event = {
            organizers: [{ user_id: 1 }],
            save: jest.fn(async () => event)
        };
        mockEventFactory.mockReturnValue(event);

        await events.addEvent({
            body: {
                name: 'Future SU',
                organizers: [{ user_id: 1 }]
            },
            user: { id: 1 },
            permissions: { create_summeruniversity: true },
            headers: { 'x-auth-token': 'user-token' }
        }, res);

        expect(mockEventFactory).toHaveBeenCalledWith(expect.objectContaining({ season: 2027 }));
    });

    test('preserves the existing season on edit when omitted', async () => {
        const res = createResponse();
        const event = {
            id: 9,
            season: 2024,
            status: 'approved',
            organizers: [{ user_id: 1 }],
            update: jest.fn(async (data) => {
                Object.assign(event, data);
                return event;
            }),
            toJSON: jest.fn(() => ({ id: 9, season: event.season }))
        };

        await events.editEvent({
            body: { name: 'Updated SU' },
            event,
            permissions: {
                edit_summeruniversity: true,
                change_status: {}
            },
            headers: { 'x-auth-token': 'user-token' }
        }, res);

        expect(event.update).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'Updated SU'
            }),
            expect.any(Object)
        );
        expect(event.update.mock.calls[0][0]).not.toHaveProperty('season');
    });
});
