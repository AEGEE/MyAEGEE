const { request } = require('./http');

const config = require('../config');

const send = (body) => request({
    url: config.mailer.url + ':' + config.mailer.port + '/',
    method: 'POST',
    body,
    fullResponse: true,
    timeout: config.mailer.timeout
}).catch((err) => {
    if (err && err.name === 'TimeoutError') {
        throw new Error(`No answer from mailer within ${config.mailer.timeout} ms`);
    }

    throw err;
});

module.exports.sendMail = async (options) => {
    const response = await send({
        from: options.from,
        to: options.to,
        subject: options.subject,
        template: options.template,
        parameters: options.parameters,
        reply_to: options.reply_to
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
