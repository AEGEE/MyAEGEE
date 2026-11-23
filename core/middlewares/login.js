const moment = require('moment');

const { User, AccessToken, RefreshToken, PasswordReset } = require('../models');
const { Sequelize, sequelize } = require('../lib/sequelize');
const errors = require('../lib/errors');
const mailer = require('../lib/mailer');
const constants = require('../lib/constants');
const config = require('../config');

module.exports.login = async (req, res) => {
    const username = (req.body.username || '').trim();

    // The login email identifies an account before the username and the Google Workspace account.
    const findBy = (field) => User.scope('withPassword').findOne({
        where: { [field]: { [Sequelize.Op.iLike]: username } }
    });
    const user = await findBy('email') || await findBy('username') || await findBy('gsuite_id');

    if (!user) {
        return errors.makeForbiddenError(res, 'User is not found.');
    }

    if (!await user.checkPassword(req.body.password)) {
        return errors.makeForbiddenError(res, 'Password is not valid.');
    }

    if (!user.mail_confirmed_at) {
        return errors.makeForbiddenError(res, 'Please confirm your mail first.');
    }

    // Some fields can be empty while registering, but we shouldn't allow login for such users.
    // TODO: think about how to make it work.
    // const notValidFields = user.notValidFields();
    // if (Object.keys(notValidFields).length !== 0) {
    //     return errors.makeValidationError(res, notValidFields);
    // }

    const accessToken = await AccessToken.createForUser(user.id);
    const refreshToken = await RefreshToken.createForUser(user.id);

    await user.update({
        last_logged_in: new Date(),
        last_active: new Date()
    });

    return res.json({
        success: true,
        access_token: accessToken.value,
        refresh_token: refreshToken.value
    });
};

// module.exports.getUserUnauthorized = async (req, res) => {
//     const username = (req.body.username || '').trim();

//     const user = await User.scope('withPassword').findOne({
//         where: {
//             [Sequelize.Op.or]: {
//                 email: username,
//                 username
//             }
//         }
//     });

//     if (!user) {
//         return errors.makeUnauthorizedError(res, 'User is not found.');
//     }

//     if (!await user.checkPassword(req.body.password)) {
//         return errors.makeUnauthorizedError(res, 'Password is not valid.');
//     }

//     return res.json({
//         success: true,
//         data: user
//     });
// };

// module.exports.updateUserUnauthorized = async (req, res) => {
//     const username = (req.body.username || '').trim();

//     const user = await User.scope('withPassword').findOne({
//         where: {
//             [Sequelize.Op.or]: {
//                 email: username,
//                 username
//             }
//         }
//     });

//     if (!user) {
//         return errors.makeUnauthorizedError(res, 'User is not found.');
//     }

//     if (!await user.checkPassword(req.body.password)) {
//         return errors.makeUnauthorizedError(res, 'Password is not valid.');
//     }

//     await user.update(req.body);

//     return res.json({
//         success: true,
//         data: user
//     });
// };

module.exports.renew = async (req, res) => {
    const tokens = await sequelize.transaction(async (t) => {
        // Locking the row so parallel renews with the same token are processed one by one.
        const token = await RefreshToken.findOne({
            where: { value: req.body.refresh_token },
            lock: t.LOCK.UPDATE,
            transaction: t
        });

        if (!token) {
            return null;
        }

        // A rotated token keeps working for a short grace period, so parallel renews both succeed.
        if (token.rotated_at) {
            const graceEnd = moment(token.rotated_at).add(config.ttl.refresh_token_grace_period, 'seconds');
            if (graceEnd.isBefore(moment())) {
                return null;
            }
        } else {
            await token.update({ rotated_at: new Date() }, { transaction: t });
        }

        return {
            accessToken: await AccessToken.createForUser(token.user_id, t),
            refreshToken: await RefreshToken.createForUser(token.user_id, t)
        };
    });

    if (!tokens) {
        return res.status(403).json({
            success: false,
            message: 'Token is not found.'
        });
    }

    return res.json({
        success: true,
        access_token: tokens.accessToken.value,
        refresh_token: tokens.refreshToken.value
    });
};

module.exports.passwordReset = async (req, res) => {
    const user = await User.findOne({
        where: { email: (req.body.email || '').trim().toLowerCase() }
    });

    if (!user) {
        return errors.makeNotFoundError(res, 'User is not found.');
    }

    await sequelize.transaction(async (t) => {
        await PasswordReset.destroy({ where: { user_id: user.id }, transaction: t });
        const currentReset = await PasswordReset.createForUser(user.id, t);

        await mailer.sendMail({
            to: user.email,
            subject: constants.MAIL_SUBJECTS.PASSWORD_RESET,
            template: 'password_reset.html',
            parameters: {
                token: currentReset.value
            }
        });
    });

    return res.json({
        success: true,
        message: 'The password reset was triggered.'
    });
};

module.exports.passwordConfirm = async (req, res) => {
    const token = await PasswordReset.findOne({
        where: { value: (req.body.token || '').trim() },
        include: [User]
    });

    if (!token) {
        return errors.makeNotFoundError(res, 'Token is invalid.');
    }

    if (moment(token.expires_at).isBefore(moment())) {
        return errors.makeNotFoundError(res, 'Token is expired.');
    }

    await token.user.update({ password: req.body.password || '' });
    await AccessToken.destroy({ where: { user_id: token.user.id } });
    await RefreshToken.destroy({ where: { user_id: token.user.id } });
    await token.destroy();

    // TODO: notify user on changed password.

    return res.json({
        success: true,
        message: 'Password was changed successfully.'
    });
};

module.exports.logout = async (req, res) => {
    const value = req.body.refresh_token;
    if (!value) {
        return errors.makeBadRequestError(res, 'Token is not provided.');
    }

    const token = await RefreshToken.findOne({
        where: { value }
    });

    if (!token) {
        return errors.makeForbiddenError(res, 'Token is not found.');
    }

    await token.destroy();

    return res.json({
        success: true,
        message: 'You are now logged out.'
    });
};
