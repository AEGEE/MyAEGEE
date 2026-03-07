jest.mock('../../lib/core', () => ({
    getMails: jest.fn()
}));

jest.mock('../../lib/helpers', () => ({
    isNumber: jest.fn(),
    getApplicationPermissions: jest.fn()
}));

jest.mock('../../lib/errors', () => ({
    makeNotFoundError: jest.fn(),
    makeBadRequestError: jest.fn()
}));

jest.mock('../../models', () => ({
    Application: {
        findOne: jest.fn()
    }
}));

const middlewares = require('../../lib/middlewares');
const core = require('../../lib/core');
const helpers = require('../../lib/helpers');
const errors = require('../../lib/errors');
const { Application } = require('../../models');

describe('Application middleware regressions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        helpers.isNumber.mockReturnValue(true);
    });

    test('incoming-only application views keep notification_email enrichment', async () => {
        const application = {
            user_id: 42,
            body_id: 7,
            dataValues: {}
        };
        const incomingApplication = {
            body_id: 7,
            dataValues: {}
        };

        Application.findOne
            .mockResolvedValueOnce(application)
            .mockResolvedValueOnce(incomingApplication);
        core.getMails.mockResolvedValue([{ notification_email: 'incoming@aegee.test' }]);
        helpers.getApplicationPermissions.mockReturnValue({
            see_application: false,
            see_application_incoming: true,
            see_boardview: {}
        });

        const req = {
            params: { application_id: '42' },
            event: { id: 9 },
            user: { id: 1 },
            permissions: {},
            corePermissions: [],
            headers: { 'x-auth-token': 'token' }
        };
        const res = {};
        const next = jest.fn();

        await middlewares.fetchSingleApplication(req, res, next);

        expect(req.application.dataValues.notification_email).toEqual('incoming@aegee.test');
        expect(next).toHaveBeenCalledTimes(1);
        expect(errors.makeNotFoundError).not.toHaveBeenCalled();
    });
});
