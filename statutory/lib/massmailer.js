const core = require('./core');
const errors = require('./errors');
const mailer = require('./mailer');
const logger = require('./logger');
const { Application } = require('../models');

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

    // If the user haven't provide the filter, use the default one.
    if (typeof req.body.filter !== 'object' || req.body.filter === null) {
        req.body.filter = {};
    }

    // Filter object, the default one is filtering out cancelled applications.
    const baseObject = { cancelled: false };

    // Then applying the filter the user has passed
    const filterObject = Object.assign(baseObject, req.body.filter);

    // Then filter application based on that filter.
    const applications = await Application.findAll({
        where: { event_id: req.event.id, ...filterObject }
    });

    logger.info({ count: applications.length }, 'Sending mass mailer to users');

    if (applications.length === 0) {
        return errors.makeBadRequestError(res, 'No users match this filter.');
    }

    const to = [];
    const userIds = applications.map((application) => application.user_id).toString();
    const mails = await core.getMails(req, userIds);
    const bodies = [];

    for (const application of applications) {
        const user = mails.find((m) => application.user_id === m.id);

        if (!user) {
            logger.warn({ user_id: application.user_id }, 'Could not find user');
            continue;
        }

        const typeAndOrder = application.participant_type
            ? (application.participant_type + ' (' + application.participant_order + ')')
            : 'not set';
        const text = req.body.text
            .replace(/\{first_name\}/ig, application.first_name)
            .replace(/\{last_name\}/ig, application.last_name)
            .replace(/\{participant_type_order\}/ig, typeAndOrder)
            .replace(/\{body_name\}/ig, application.body_name)
            .replace(/\{statutory_id\}/ig, application.statutory_id);

        // Using the custom mailer template, it accepts only body as a parameter
        // and sends the body as it was passed.
        const notificationEmail = user.notification_email;
        to.push(notificationEmail);
        bodies.push({ body: text });

        logger.info({ notificationEmail }, 'Prepared email');
    }

    logger.info({ count: bodies.length }, 'Prepared letters');

    await mailer.sendMail({
        reply_to: req.body.reply_to,
        to,
        subject: req.body.subject,
        template: 'custom.html',
        parameters: bodies
    });

    return res.json({
        success: true,
        message: 'Mail was sent successfully.',
        meta: { sent: bodies.length }
    });
};
