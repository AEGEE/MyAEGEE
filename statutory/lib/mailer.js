const request = require('request-promise-native');

const config = require('../config');

module.exports.sendMail = async (options) => {
    // Mails won't be sent if there's failure for at least 1 user for whatever reason.
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
            parameters: options.parameters
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
