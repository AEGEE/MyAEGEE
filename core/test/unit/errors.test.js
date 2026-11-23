const errors = require('../../lib/errors');
const { Sequelize } = require('../../lib/sequelize');

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

const validationErrorItem = (message, path) => new Sequelize.ValidationErrorItem(message, 'Validation error', path);

describe('Errors', () => {
    describe('BadRequestError', () => {
        test('should be an error with its own name and the given message', () => {
            const err = new errors.BadRequestError('The list cannot be sorted by this field.');

            expect(err).toBeInstanceOf(Error);
            expect(err.name).toEqual('BadRequestError');
            expect(err.message).toEqual('The list cannot be sorted by this field.');
        });
    });

    describe('makeError', () => {
        test('should answer with a text as the message', () => {
            const res = makeResponse();

            const result = errors.makeError(res, 418, 'Something is wrong.');

            expect(result).toBe(res);
            expect(res.statusCode).toEqual(418);
            expect(res.body).toEqual({ success: false, message: 'Something is wrong.' });
        });

        test('should answer with the messages of a Sequelize validation error, per field', () => {
            const res = makeResponse();
            const err = new Sequelize.ValidationError('Validation error', [
                validationErrorItem('First name should be set.', 'first_name'),
                validationErrorItem('First name is too short.', 'first_name'),
                validationErrorItem('Email is not valid.', 'email')
            ]);

            errors.makeError(res, 422, err);

            expect(res.statusCode).toEqual(422);
            expect(res.body).toEqual({
                success: false,
                errors: {
                    first_name: ['First name should be set.', 'First name is too short.'],
                    email: ['Email is not valid.']
                }
            });
        });

        test('should answer with the messages of a unique constraint error, per field', () => {
            const res = makeResponse();
            const err = new Sequelize.UniqueConstraintError({
                errors: [validationErrorItem('email must be unique', 'email')]
            });

            errors.makeError(res, 422, err);

            expect(res.statusCode).toEqual(422);
            expect(res.body).toEqual({
                success: false,
                errors: { email: ['email must be unique'] }
            });
        });

        test('should answer with a plain object as the errors', () => {
            const res = makeResponse();

            errors.makeError(res, 422, { user_id: ['User is not a member.'] });

            expect(res.statusCode).toEqual(422);
            expect(res.body).toEqual({
                success: false,
                errors: { user_id: ['User is not a member.'] }
            });
        });

        test('should answer with the message of any other error', () => {
            const res = makeResponse();

            errors.makeError(res, 400, new TypeError('Not a number.'));

            expect(res.statusCode).toEqual(400);
            expect(res.body).toEqual({ success: false, message: 'Not a number.' });
        });
    });

    describe('status code helpers', () => {
        test.each([
            ['makeBadRequestError', 400],
            ['makeUnauthorizedError', 401],
            ['makeForbiddenError', 403],
            ['makeNotFoundError', 404],
            ['makeConflictError', 409],
            ['makeValidationError', 422]
        ])('%s should answer %i with the given error', (helper, statusCode) => {
            const res = makeResponse();

            errors[helper](res, 'The reason.');

            expect(res.statusCode).toEqual(statusCode);
            expect(res.body).toEqual({ success: false, message: 'The reason.' });
        });

        test('makeInternalError should answer 500 with a fixed text, whatever it is given', () => {
            const res = makeResponse();

            errors.makeInternalError(res, new Error('relation "users" does not exist'));

            expect(res.statusCode).toEqual(500);
            expect(res.body).toEqual({ success: false, message: 'Something went wrong on the server.' });
        });

        test('makeBusyError should answer 503 and ask to try again', () => {
            const res = makeResponse();

            errors.makeBusyError(res);

            expect(res.statusCode).toEqual(503);
            expect(res.body).toEqual({
                success: false,
                message: 'Another request for the same data is being processed. Please try again in a moment.'
            });
        });
    });

    describe('isLockTimeout', () => {
        test('should recognise the error Postgres gives for a lock that was not available in time', () => {
            expect(errors.isLockTimeout({ parent: { code: '55P03' } })).toEqual(true);
        });

        test('should not take another database error for it', () => {
            expect(errors.isLockTimeout({ parent: { code: '23505' } })).toEqual(false);
        });

        test('should not take an error without a database error behind it for it', () => {
            expect(errors.isLockTimeout(new Error('55P03'))).toEqual(false);
            expect(errors.isLockTimeout({ parent: null })).toEqual(false);
        });

        test('should answer false for no error at all', () => {
            expect(errors.isLockTimeout(null)).toEqual(false);
            expect(errors.isLockTimeout(undefined)).toEqual(false);
        });
    });
});
