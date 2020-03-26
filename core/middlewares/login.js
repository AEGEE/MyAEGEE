const moment = require('moment');

const { User, AccessToken, RefreshToken, PasswordReset } = require('../models');
const { Sequelize } = require('../lib/sequelize');
const errors = require('../lib/errors');

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

    await PasswordReset.destroy({ where: { user_id: user.id } });
    await PasswordReset.createForUser(user.id);

    // TODO: send a password reset to user.

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
