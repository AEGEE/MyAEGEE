const { User, AccessToken, RefreshToken } = require('../models');
const { Sequelize } = require('../lib/sequelize');
const errors = require('../lib/errors');

module.exports.login = async (req, res) => {
    const user = await User.scope('withPassword').findOne({
        where: {
            [Sequelize.Op.or]: {
                email: req.body.username,
                username: req.body.username
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
        value: req.body.token
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
