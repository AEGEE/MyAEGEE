jest.mock('../../lib/core', () => ({
    fetchUser: jest.fn(),
    getAdminToken: jest.fn(),
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
    Application: {},
    Event: {}
}));

const applications = require('../../lib/applications');
const core = require('../../lib/core');
const mailer = require('../../lib/mailer');

function createResponse() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    };
}

describe('Summer University application editing regressions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        core.getAdminToken.mockResolvedValue('admin-token');
        core.fetchUser.mockImplementation(async (userLike) => ({
            ...userLike,
            notification_email: `user-${userLike.user_id}@aegee.test`
        }));
        core.getBodyUsersForPermission.mockResolvedValue([]);
        mailer.sendMail.mockResolvedValue({ success: true });
    });

    test('preserves the original applicant identity when an organizer edits the application', async () => {
        const res = createResponse();
        const application = {
            id: 15,
            user_id: 99,
            first_name: 'Original',
            last_name: 'Applicant',
            body_id: 7,
            body_name: 'AEGEE-Original',
            answers: ['old'],
            update: jest.fn(async (data) => {
                Object.assign(application, data);
                return application;
            })
        };

        await applications.updateApplication({
            body: { answers: ['new'] },
            application,
            event: { id: 3, name: 'SU Test', organizers: [{ user_id: 12 }] },
            user: {
                id: 1,
                first_name: 'Editor',
                last_name: 'User',
                bodies: [{ id: 1, name: 'AEGEE-Editor' }]
            },
            permissions: { edit_application: true },
            headers: { 'x-auth-token': 'auth-token' }
        }, res);

        expect(application.update).toHaveBeenCalledWith(expect.objectContaining({
            answers: ['new'],
            user_id: 99,
            first_name: 'Original',
            last_name: 'Applicant'
        }), expect.any(Object));
        expect(core.fetchUser).toHaveBeenCalledWith(application, 'auth-token');
        expect(mailer.sendMail).toHaveBeenCalledWith(expect.objectContaining({
            to: 'user-99@aegee.test',
            template: 'summeruniversity_application_edited.html'
        }));
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            message: 'Application is updated',
            data: application
        });
    });
});
