const { request } = require('./http');

const config = require('../config');
const { createMailError } = require('./errors');

/**
 * @param {Object} options
 * @param {string|string[]} options.to
 * @param {string} options.template
 * @param {string} options.subject
 * @param {object} options.reply_to
 * @param {object} options.parameters
 */
module.exports.sendMail = async (options) => {
    const { timeout } = config.mailer;
    let response;

    try {
        response = await request({
            url: config.mailer.url + ':' + config.mailer.port + '/',
            method: 'POST',
            body: {
                from: options.from,
                to: options.to,
                subject: options.subject,
                template: options.template,
                parameters: options.parameters,
                reply_to: options.reply_to
            },
            fullResponse: true,
            timeout
        });
    } catch (err) {
        // A mailer that hangs must not hold the request, and the database transaction around it, for longer.
        if (err.name === 'TimeoutError') {
            throw createMailError(`No response from mailer within ${timeout} ms`, err);
        }

        throw createMailError('Could not reach the mailer', err);
    }

    const mailerBody = response.body;

    // The messages carry the status only: the mailer's error text can name a recipient.
    if (!mailerBody || typeof mailerBody !== 'object') {
        throw createMailError(`Malformed response from mailer (status ${response.statusCode})`);
    }

    if (!mailerBody.success) {
        throw createMailError(`Unsuccessful response from mailer (status ${response.statusCode})`);
    }

    return mailerBody;
};
