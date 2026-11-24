const { MailConfirmation, User } = require('../models');
const errors = require('../lib/errors');
const helpers = require('../lib/helpers');

module.exports.confirmEmail = async (req, res) => {
    const token = helpers.stringOrEmpty(req.body.token);
    if (!token) {
        return errors.makeBadRequestError(res, 'No token specified.');
    }

    const confirmation = await MailConfirmation.findOne({
        where: { value: token },
        include: [User]
    });

    if (!confirmation) {
        return errors.makeNotFoundError(res, 'The token is invalid.');
    }

    if (confirmation.is_expired) {
        return errors.makeForbiddenError(res, 'The token has expired.');
    }

    await confirmation.user.update({ mail_confirmed_at: new Date() });
    await confirmation.destroy();

    return res.json({
        success: true,
        message: 'Your profile is activated.'
    });
};
