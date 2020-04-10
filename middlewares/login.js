const moment = require('moment');

const { User, AccessToken, RefreshToken, PasswordReset } = require('../models');
const { Sequelize, sequelize } = require('../lib/sequelize');
const errors = require('../lib/errors');
const mailer = require('../lib/mailer');
const constants = require('../lib/constants');

module.exports.login = async (req, res) => {
    const username = (req.body.username || '').trim();

    const user = await User.scope('withPassword').findOne({
        where: {
            [Sequelize.Op.or]: {
                email: username,
                username
            }
        }
    });

    if (!user) {
        return errors.makeUnauthorizedError(res, 'User is not found.');
    }

    if (!await user.checkPassword(req.body.password)) {
        return errors.makeUnauthorizedError(res, 'Password is not valid.');
    }

    if (!user.mail_confirmed_at) {
        return errors.makeUnauthorizedError(res, 'Please confirm your mail first.');
    }

    // Some fields can be empty while registering, but we shouldn't allow login for such users.
    // TODO: think about how to make it work.
    // const notValidFields = user.notValidFields();
    // if (Object.keys(notValidFields).length !== 0) {
    //     return errors.makeValidationError(res, notValidFields);
    // }


    const accessToken = await AccessToken.createForUser(user.id);
    const refreshToken = await RefreshToken.createForUser(user.id);

    return res.json({
        success: true,
        data: {
            access_token: accessToken.value,
            refresh_token: refreshToken.value
        }
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
    const token = await RefreshToken.findOne({
        where: { value: req.body.token }
    });

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Token is not found.'
        });
    }

    const accessToken = await AccessToken.createForUser(token.user_id);

    return res.json({
        success: true,
        data: {
            access_token: accessToken.value,
        }
    });
};

module.exports.passwordReset = async (req, res) => {
    const user = await User.findOne({
        where: { email: (req.body.email || '').trim() }
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
