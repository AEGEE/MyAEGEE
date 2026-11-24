const logger = require('./logger');
const Bugsnag = require('./bugsnag');

// Logs a mail that could not be sent and reports it to the error tracker, with the template
// (set on the errors of the mailer client) and the ids that the caller knows. Addresses are
// never passed: the fields go to the log and to the error tracker as they are.
exports.reportMailFailure = (err, message, ids) => {
    const fields = { template: err.template, ...ids };

    logger.error({ err, ...fields }, message);
    Bugsnag.notify(err, (event) => {
        event.addMetadata('mail', fields);
    });
};
