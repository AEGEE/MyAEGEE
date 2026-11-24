const moment = require('moment');
const bcrypt = require('bcrypt');

const { User, AccessToken, RefreshToken, PasswordReset } = require('../models');
const { sequelize, Sequelize } = require('../lib/sequelize');
const errors = require('../lib/errors');
const helpers = require('../lib/helpers');
const logger = require('../lib/logger');
const mailer = require('../lib/mailer');
const Bugsnag = require('../lib/bugsnag');
const metrics = require('./metrics');
const constants = require('../lib/constants');
const config = require('../config');

const INVALID_CREDENTIALS = 'Username or password is not valid.';
const PASSWORD_RESET_REQUESTED = 'If this email belongs to an account, a password reset was sent to it.';

// The hash that the password is compared with when there's no account, so that answering takes
// as long as for an account with another password. It is made with the cost that the stored
// password hashes have (`config.salt_rounds`), so both comparisons do the same amount of work.
let placeholderHash;
const checkPlaceholderPassword = async (password) => {
    if (!placeholderHash) {
        placeholderHash = helpers.getRandomBytes(constants.TOKEN_LENGTH.PASSWORD_RESET)
            .then((random) => bcrypt.hash(random, config.salt_rounds));
        // A hash that could not be made is made again at the next login.
        placeholderHash.catch(() => {
            placeholderHash = undefined;
        });
    }

    await bcrypt.compare(password, await placeholderHash);
    return false;
};

module.exports.login = async (req, res) => {
    // Anything that is not a string is answered like a name or a password that doesn't match.
    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    // The login email identifies an account before the username and the Google Workspace account.
    // All three lookups run for every request, whichever of them finds the account.
    const findBy = (field) => User.scope('withPassword').findOne({
        where: helpers.equalsIgnoreCase(field, username)
    });
    const byEmail = await findBy('email');
    const byUsername = await findBy('username');
    const byWorkspaceAccount = await findBy('gsuite_id');
    const user = byEmail || byUsername || byWorkspaceAccount;

    // One answer for an account that doesn't exist and for a password that is not the right one.
    const isPasswordValid = user
        ? await user.checkPassword(password)
        : await checkPlaceholderPassword(password);

    if (!isPasswordValid) {
        return errors.makeForbiddenError(res, INVALID_CREDENTIALS);
    }

    // Only told to somebody who knows the password.
    if (!user.active) {
        return errors.makeForbiddenError(res, 'This account is suspended.');
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
    // No token, or something that can't be one, is answered like a token that doesn't exist.
    const value = helpers.stringOrEmpty(req.body.refresh_token);

    const tokens = value && await sequelize.transaction(async (t) => {
        await helpers.setLockTimeout(t);

        // Locking the row so parallel renews with the same token are processed one by one.
        const token = await RefreshToken.findOne({
            where: { value },
            lock: t.LOCK.UPDATE,
            transaction: t
        });

        if (!token) {
            return null;
        }

        // The tokens of a suspended member are answered like tokens that don't exist.
        const user = await User.findByPk(token.user_id, { attributes: ['id', 'active'], transaction: t });
        if (!user || !user.active) {
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

// Creates a password reset for the account with this login email, if there is one, and mails it.
const sendPasswordReset = async (email) => {
    let user;
    let reset;

    try {
        user = email
            ? await User.findOne({ where: helpers.equalsIgnoreCase('email', email) })
            : null;

        // A suspended member gets no reset, but the answer does not say so.
        if (!user || !user.active) {
            return;
        }

        // The reset is stored first and mailed after the commit, so that a slow mailer
        // holds neither a database connection nor the member's lock.
        reset = await sequelize.transaction(async (t) => {
            // A change of the login email that is being confirmed finishes first, and the
            // reset only goes out if the account still has the address it was asked for.
            await helpers.lockMailChanges(user.id, t);
            const current = await User.findOne({
                where: { [Sequelize.Op.and]: [{ id: user.id }, helpers.equalsIgnoreCase('email', email)] },
                transaction: t
            });
            if (!current) {
                return null;
            }

            await PasswordReset.destroy({ where: { user_id: user.id }, transaction: t });
            const created = await PasswordReset.createForUser(user.id, t);

            return { id: created.id, value: created.value, email: current.email };
        });

        if (!reset) {
            return;
        }

        await mailer.sendMail({
            to: reset.email,
            subject: constants.MAIL_SUBJECTS.PASSWORD_RESET,
            template: 'password_reset.html',
            parameters: {
                token: reset.value
            }
        });
    } catch (err) {
        // Nobody is waiting for the result anymore, so a failure only shows up here:
        // in the log, in the error tracker and in the counter on /metrics.
        logger.error({ err, user_id: user ? user.id : null }, 'Could not send a password reset');
        metrics.passwordResetFailures.inc();
        Bugsnag.notify(err);

        // A reset whose mail did not go out is of no use.
        if (reset) {
            await PasswordReset.destroy({ where: { id: reset.id } });
        }
    }
};

const pendingPasswordResets = new Set();

// For the tests: resolves when the password resets which were requested so far are processed.
module.exports.waitForPasswordResets = () => Promise.all(pendingPasswordResets);

// Answers right away and always the same. The reset is created and mailed after that, so neither
// the answer nor the time it takes tell whether the address belongs to an account.
module.exports.passwordReset = async (req, res) => {
    // No email is answered like an address without an account; a value that can't be an address is refused.
    if (req.body.email !== undefined && req.body.email !== null && typeof req.body.email !== 'string') {
        return errors.makeBadRequestError(res, 'Email should be a string.');
    }

    const email = (req.body.email || '').trim();

    const job = sendPasswordReset(email).finally(() => pendingPasswordResets.delete(job));
    pendingPasswordResets.add(job);

    return res.json({
        success: true,
        message: PASSWORD_RESET_REQUESTED
    });
};

module.exports.passwordConfirm = async (req, res) => {
    const token = await PasswordReset.findOne({
        where: { value: helpers.stringOrEmpty(req.body.token).trim() },
        include: [User]
    });

    // The link of a suspended member does not work, as if it did not exist.
    if (!token || !token.user.active) {
        return errors.makeNotFoundError(res, 'Token is invalid.');
    }

    if (moment(token.expires_at).isBefore(moment())) {
        return errors.makeNotFoundError(res, 'Token is expired.');
    }

    await token.user.update({ password: helpers.stringOrEmpty(req.body.password) });
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
    const value = helpers.stringOrEmpty(req.body.refresh_token);
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
