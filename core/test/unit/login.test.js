const login = require('../../middlewares/login');
const metrics = require('../../middlewares/metrics');
const helpers = require('../../lib/helpers');
const logger = require('../../lib/logger');
const Bugsnag = require('../../lib/bugsnag');
const { User } = require('../../models');

// What a handler gets as `res`: remembers the status code and the body of the answer.
const makeResponse = () => {
    const res = {};
    res.status = jest.fn((statusCode) => {
        res.statusCode = statusCode;
        return res;
    });
    res.json = jest.fn((body) => {
        res.body = body;
        return res;
    });
    return res;
};

describe('Login', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    // A login for an account that doesn't exist compares the password with a placeholder hash,
    // which is made at the first such login and kept.
    describe('the placeholder hash', () => {
        const req = { body: { username: 'no-such-member', password: 'a password' } };

        test('should fail the login if it cannot be made, be made again at the next login and be kept then', async () => {
            const failure = new Error('No entropy');
            const getRandomBytes = jest.spyOn(helpers, 'getRandomBytes').mockRejectedValueOnce(failure);
            const failed = makeResponse();

            await expect(login.login(req, failed)).rejects.toBe(failure);
            expect(failed.json).not.toHaveBeenCalled();
            expect(getRandomBytes).toHaveBeenCalledTimes(1);

            const second = makeResponse();
            await login.login(req, second);

            expect(getRandomBytes).toHaveBeenCalledTimes(2);
            expect(second.statusCode).toEqual(403);
            expect(second.body).toEqual({ success: false, message: 'Username or password is not valid.' });

            const third = makeResponse();
            await login.login(req, third);

            expect(getRandomBytes).toHaveBeenCalledTimes(2);
            expect(third.statusCode).toEqual(403);
            expect(third.body).toEqual({ success: false, message: 'Username or password is not valid.' });
        });
    });

    // The answer to a password reset does not wait for the reset, so nobody is told if it fails.
    describe('a password reset that fails before the account is found', () => {
        test('should be answered like any other, logged without a member, counted and reported', async () => {
            const failure = new Error('Connection terminated unexpectedly');
            jest.spyOn(User, 'findOne').mockRejectedValue(failure);
            const errorLog = jest.spyOn(logger, 'error').mockImplementation(() => {});
            const notify = jest.spyOn(Bugsnag, 'notify').mockImplementation(() => {});
            const count = jest.spyOn(metrics.passwordResetFailures, 'inc');
            const res = makeResponse();

            await login.passwordReset({ body: { email: 'member@example.com' } }, res);
            await login.waitForPasswordResets();

            expect(res.status).not.toHaveBeenCalled();
            expect(res.body).toEqual({
                success: true,
                message: 'If this email belongs to an account, a password reset was sent to it.'
            });
            expect(errorLog).toHaveBeenCalledTimes(1);
            expect(errorLog).toHaveBeenCalledWith(
                { err: failure, template: undefined, user_id: null, password_reset_id: null },
                'Could not send a password reset'
            );
            expect(count).toHaveBeenCalledTimes(1);
            expect(notify).toHaveBeenCalledTimes(1);
            expect(notify).toHaveBeenCalledWith(failure, expect.any(Function));
        });
    });
});
