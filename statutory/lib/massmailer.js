const nodemailer = require('nodemailer');
const { errors, communication } = require('oms-common-nodejs');
const request = require('request-promise-native');

const helpers = require('./helpers');
const config = require('../config');
const logger = require('./logger');

exports.sendAll = async (req, res) => {
    if (!req.permissions.use_massmailer) {
        return errors.makeForbiddenError(res, 'You cannot access massmailer.');
    }

    const applications = req.params.filter
        ? req.event.applications.filter(application => application.status === req.params.filter)
        : req.event.applications;

    const stats = {
        total: applications.length,
        sent: 0,
        errors: 0
    }

    let transporter = nodemailer.createTransport({
        host: config.mailer.host,
        port: config.mailer.port,
        secure: false,
        auth: {
            user: config.mailer.username,
            pass: config.mailer.password
        }
    });
    logger.info(`Sending mass mailer to ${applications.length} users`)
    logger.info(`Filter = ${req.params.filter}`);

    const headers = await communication.getRequestHeaders(req);

    for (const application of applications) {
        // Fetching user
        try {
            const membersBody = await request({
                url: config.core.url + ':' + config.core.port + '/members/' + application.user_id,
                method: 'GET',
                headers,
                simple: false,
                json: true,
            });
            const email = membersBody.data.user.email;

            // Sending mail
            let mailOptions = {
                from: req.body.from, // sender address
                to: email, // list of receivers
                subject: req.body.subject, // Subject line
                text: req.body.text // plain text body
            };

            logger.info('Sending mass mailer email to ' + email + '...');
            await transporter.sendMail(mailOptions);
            stats.sent++
        } catch (err) {
            stats.errors++
            logger.error('Delivering mail failed: ' + err.message);
        }
    }

    return res.json({
        success: true,
        data: stats
    })
}
