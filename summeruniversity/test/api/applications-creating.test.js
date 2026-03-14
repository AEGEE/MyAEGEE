jest.mock('../../lib/core', () => ({
    getAdminToken: jest.fn(),
    fetchUser: jest.fn(),
    getBodyUsersForPermission: jest.fn()
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
    Application: {
        create: jest.fn()
    },
    Event: {}
}));

const applications = require('../../lib/applications');
const core = require('../../lib/core');
const mailer = require('../../lib/mailer');
const { Application } = require('../../models');

function createResponse() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    };
}

describe('Summer University application regressions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        core.getAdminToken.mockResolvedValue('admin-token');
        core.fetchUser.mockImplementation(async (user) => ({
            ...user,
            notification_email: `user-${user.user_id}@aegee.test`
        }));
        core.getBodyUsersForPermission.mockResolvedValue([]);
        mailer.sendMail.mockResolvedValue({ success: true });
        Application.create.mockResolvedValue({ id: 1, body_id: 11 });
    });

    test('returns validation error when body_id is missing instead of crashing', async () => {
        const res = createResponse();

        await applications.createApplication({
            body: {
                answers: [],
                agreed_to_privacy_policy: true
            },
            user: {
                id: 99,
                first_name: 'Ari',
                last_name: 'Tester',
                notification_email: 'ari@aegee.test',
                bodies: [{ id: 11, name: 'AEGEE-Test' }]
            },
            event: {
                id: 7,
                name: 'Summer University',
                organizers: [{ user_id: 1 }]
            },
            permissions: { apply: true },
            headers: { 'x-auth-token': 'user-token' }
        }, res);

        expect(res.status).toHaveBeenCalledWith(422);
        expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Body should be set.' });
        expect(Application.create).not.toHaveBeenCalled();
    });
});
