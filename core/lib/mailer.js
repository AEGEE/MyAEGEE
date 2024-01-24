const request = require('request-promise-native');

const config = require('../config');

/**
 * @param {Object} options
 * @param {string|string[]} options.to
 * @param {string} options.template
 * @param {string} options.subject
 * @param {object} options.reply_to
 * @param {object} options.parameters
 */
module.exports.sendMail = async (options) => {
    const mailerBody = await request({
        url: config.mailer.url + ':' + config.mailer.port + '/',
        method: 'POST',
        simple: false,
        json: true,
        body: {
            from: options.from,
            to: options.to,
            subject: options.subject,
            template: options.template,
            parameters: options.parameters,
            reply_to: options.reply_to
        }
    });

    if (typeof mailerBody !== 'object') {
        throw new Error('Malformed response from mailer: ' + mailerBody);
    }

    if (!mailerBody.success) {
        throw new Error('Unsuccessful response from mailer: ' + JSON.stringify(mailerBody));
    }

    return mailerBody;
};
