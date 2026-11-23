const { request } = require('./http');

const config = require('../config');

const post = async (options) => {
    try {
        return await request(options);
    } catch (err) {
        if (err.name === 'TimeoutError') {
            throw new Error(`The mailer did not answer within ${options.timeout} ms`);
        }

        throw err;
    }
};

module.exports.sendMail = async (options) => {
    const response = await post({
        url: config.mailer.url + ':' + config.mailer.port + '/',
        method: 'POST',
        timeout: config.mailer.timeout,
        body: {
            from: options.from,
            to: options.to,
            cc: options.cc,
            subject: options.subject,
            template: options.template,
            parameters: options.parameters,
            reply_to: options.reply_to
        },
        fullResponse: true
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
