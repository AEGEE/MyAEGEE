const members = require('../../middlewares/members');
const generator = require('../scripts/generator');
const { MailChange, User } = require('../../models');

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

describe('Members', () => {
    afterEach(async () => {
        jest.restoreAllMocks();
        await generator.clearAll();
    });

    describe('confirming an email change', () => {
        // The handler looks the change up by its token, then locks the changes of the member and
        // reads the change again. Another confirmation can take effect between the two.
        test('should answer that the token is invalid if the change is gone by the time it is locked', async () => {
            const user = await generator.createUser({ email: 'current@example.com' });
            const mailChange = await generator.createMailChange(user, {
                value: 'a-token-for-the-new-address',
                new_email: 'new@example.com',
                expires_at: new Date('2999-12-31T00:00:00.000Z')
            });
            const findOne = MailChange.findOne.bind(MailChange);
            const lookup = jest.spyOn(MailChange, 'findOne').mockImplementationOnce(async (options) => {
                const found = await findOne(options);
                await MailChange.destroy({ where: { id: found.id } });
                return found;
            });
            const res = makeResponse();

            await members.confirmEmailChange({ body: { token: 'a-token-for-the-new-address' } }, res);

            expect(lookup).toHaveBeenCalledTimes(2);
            expect(res.statusCode).toEqual(404);
            expect(res.body).toEqual({ success: false, message: 'Token is invalid.' });
            expect(await MailChange.findByPk(mailChange.id)).toBeNull();
            expect((await User.findByPk(user.id)).email).toEqual('current@example.com');
        });

        test('should answer that the token is invalid if the member is gone by the time the change is locked', async () => {
            const user = await generator.createUser({ email: 'current@example.com' });
            await generator.createMailChange(user, {
                value: 'a-token-for-the-new-address',
                new_email: 'new@example.com',
                expires_at: new Date('2999-12-31T00:00:00.000Z')
            });
            const findOne = MailChange.findOne.bind(MailChange);
            jest.spyOn(MailChange, 'findOne').mockImplementationOnce(async (options) => {
                const found = await findOne(options);
                await User.destroy({ where: { id: user.id } });
                return found;
            });
            const res = makeResponse();

            await members.confirmEmailChange({ body: { token: 'a-token-for-the-new-address' } }, res);

            expect(res.statusCode).toEqual(404);
            expect(res.body).toEqual({ success: false, message: 'Token is invalid.' });
        });
    });
});
