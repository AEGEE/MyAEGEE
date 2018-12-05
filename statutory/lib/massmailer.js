const { errors } = require('oms-common-nodejs');
const request = require('request-promise-native');

const config = require('../config');
const logger = require('./logger');

exports.sendAll = async (req, res) => {
    if (!req.permissions.use_massmailer) {
        return errors.makeForbiddenError(res, 'You cannot access massmailer.');
    }

    const applications = req.params.filter
        ? req.event.applications.filter(application => application.status === req.params.filter)
        : req.event.applications;

    logger.info(`Sending mass mailer to ${applications.length} users`);
    logger.info(`Filter = ${req.params.filter || 'not set'}`);

    const to = [];
    const bodies = [];

    for (const application of applications) {
        // Fetching user
        try {
            const membersBody = await request({
                url: config.core.url + ':' + config.core.port + '/members/' + application.user_id,
                method: 'GET',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-Auth-Token': req.headers['x-auth-token'],
                },
                simple: false,
                json: true,
            });
            const body = membersBody.data.bodies.find(body => body.id === application.body_id);

            // We can customize the letter a little bit by replacing { something } with corresponding field.
            // TODO: Think, maybe use Pug or EJS for that?
            const email = membersBody.data.user.email;
            const text = req.body.text
                .replace(/\{ first_name \}/ig, membersBody.data.first_name)
                .replace(/\{ last_name \}/ig, membersBody.data.last_name)
                .replace(/\{ participant_type \}/ig, application.participant_type)
                .replace(/\{ participant_order \}/ig, application.participant_order)
                .replace(/\{ body_name \}/ig, body.name);

            // Using the custom oms-mailer template, it accepts only body as a parameter
            // and sends the body as it was passed.
            to.push(email);
            bodies.push({ body: text });

            logger.info('Prepared email to ' + email + '...');
        } catch (err) {
            logger.error('Preparing mail failed for ' + email + ':' + err.message);
        }
    }

    logger.info('Prepared letters: ' + bodies.length);

    const mailerBody = await request({
        url: config.mailer.url + ':' + config.mailer.port + '/',
        method: 'POST',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'X-Auth-Token': req.headers['x-auth-token'],
        },
        simple: false,
        json: true,
        body: {
            from: req.body.from,
            to,
            subject: req.body.subject,
            template: 'custom.html',
            parameters: bodies
        }
    });

    if (typeof mailerBody !== 'object') {
        return errors.makeInternalError(res, 'Malformed response from mailer: ' + mailerBody);
    }

    if (!mailerBody.success) {
        return errors.makeInternalError(res, 'Unsuccessful response from mailer: ' + mailerBody);
    }

    return res.json({
        success: true,
        data: stats
    });
};
