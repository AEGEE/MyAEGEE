const { errors } = require('oms-common-nodejs');
const request = require('request-promise-native');

const config = require('../config');
const logger = require('./logger');

// TODO: Take the email, first and last name from the application
// once it would be there. For now, if there would be 800 emails and
// 799 of them would be sent successfully and the last one would fail, everything won't be sent.
// Also so it wouldn't do 800 requests at once to core fetching the email.
exports.sendAll = async (req, res) => {
    if (!req.permissions.use_massmailer) {
        return errors.makeForbiddenError(res, 'You cannot access massmailer.');
    }

    if (typeof req.body.text !== 'string' || req.body.text.trim().length === 0) {
        return errors.makeBadRequestError(res, 'Please provide an email body.');
    }

    if (typeof req.body.subject !== 'string' || req.body.subject.trim().length === 0) {
        return errors.makeBadRequestError(res, 'Please provide an email subject.');
    }

    let applications = req.params.filter
        ? req.event.applications.filter(application => application.status === req.params.filter)
        : req.event.applications;

    logger.info(`Sending mass mailer to ${applications.length} users`);
    logger.info(`Filter = ${req.params.filter || 'not set'}`);

    applications = applications.filter(application => !application.cancelled);
    logger.info(`Filtered cancelled applications, total amount of letters: ${applications.length}`);

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
            if (typeof membersBody !== 'object') {
                throw new Error('Malformed response when fetching user: ' + membersBody);
            }

            if (!membersBody.success) {
                throw new Error('Error fetching user: ' + JSON.stringify(membersBody));
            }

            const body = membersBody.data.bodies.find(body => body.id === application.body_id);
            if (!body) {
                throw new Error('The body of the application is not on the user\'s bodies.')
            }

            // We can customize the letter a little bit by replacing {something} with corresponding field.
            // TODO: Think, maybe use Pug or EJS for that?
            // TODO: Think what else will we need? Probably remove after Agora Bucuresti if there
            // won't be something required.
            const email = membersBody.data.user.email;
            const typeAndOrder = application.participant_type
                ? (application.participant_type + ' (' + application.participant_order + ')')
                : 'not set';
            const text = req.body.text
                .replace(/\{first_name\}/ig, membersBody.data.first_name)
                .replace(/\{last_name\}/ig, membersBody.data.last_name)
                .replace(/\{participant_type_order\}/ig, typeAndOrder)
                .replace(/\{body_name\}/ig, body.name);

            // Using the custom oms-mailer template, it accepts only body as a parameter
            // and sends the body as it was passed.
            to.push(email);
            bodies.push({ body: text });

            logger.info('Prepared email to ' + email + '...');
        } catch (err) {
            logger.error('Preparing mail failed: ' + err);
            return errors.makeInternalError(res, 'Sending mail failed:' + err.message);
        }
    }

    logger.info('Prepared letters: ' + bodies.length);

    // Mails won't be sent if there's failure for at least 1 user for whatever reason.
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
        throw new Error('Malformed response from mailer: ' + mailerBody);
    }

    if (!mailerBody.success) {
        throw new Error('Unsuccessful response from mailer: ' + JSON.stringify(mailerBody));
    }

    return res.json({
        success: true,
        message: 'Mail was sent successfully.'
    });
};
