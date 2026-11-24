const { Counter } = require('prom-client');

const { request } = require('./http');
const config = require('../config');
const logger = require('./logger');
const Bugsnag = require('./bugsnag');

const failedMails = new Counter({
    name: 'statutory_mails_failed_total',
    help: 'Mails about a saved change that could not be sent',
    labelNames: ['template']
});

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

// Sends a mail about a change that is saved already: `send` does the lookups the mail needs
// and sends it. A failure does not undo the change. It is logged with the ids of the records
// and the template (never the addresses), counted, reported, and the request goes on.
module.exports.sendMailAfterSave = async ({ template, ids }, send) => {
    try {
        await send();
    } catch (err) {
        failedMails.inc({ template });
        logger.error({ err, template, ...ids }, 'Could not send a mail about a saved change');

        if (process.env.NODE_ENV !== 'test') {
            Bugsnag.notify(err, (event) => {
                event.addMetadata('mail', { template, ...ids });
            });
        }
    }
};
