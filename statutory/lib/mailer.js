const { request } = require('./http');

const config = require('../config');

module.exports.sendMail = async (options) => {
    const response = await request({
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
        timeout: config.mailer.timeout
    });

    const mailerBody = response.body;

    // The messages carry the status only: the mailer's error text can name a recipient.
    if (!mailerBody || typeof mailerBody !== 'object') {
        throw new Error(`Malformed response from mailer (status ${response.statusCode})`);
    }

    if (!mailerBody.success) {
        throw new Error(`Unsuccessful response from mailer (status ${response.statusCode})`);
    }

    return mailerBody;
};
