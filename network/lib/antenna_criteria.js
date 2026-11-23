const { AntennaCriterion } = require('../models');
const errors = require('./errors');
const helpers = require('./helpers');
const mailer = require('./mailer');
const constants = require('./constants');

// One address, local part and domain, no display name.
const EMAIL_REGEX = /^[^\s@<>()",;:]+@([^\s@<>()",;:]+)$/;

const isAegeeAddress = (value) => {
    const match = typeof value === 'string' ? EMAIL_REGEX.exec(value) : null;
    return Boolean(match) && constants.AEGEE_MAIL_DOMAINS.includes(match[1].toLowerCase());
};

exports.listCriteria = async (req, res) => {
    if (!req.permissions.manage_antenna_criteria) {
        return errors.makeForbiddenError(res, 'You are not allowed to list Antenna Criteria.');
    }

    if (!helpers.isNumber(req.params.agora_id)) {
        return errors.makeBadRequestError(res, 'Agora ID is invalid.');
    }

    const criteria = await AntennaCriterion.findAll({
        where: { agora_id: Number(req.params.agora_id) }
    });

    return res.json({
        success: true,
        data: criteria
    });
};

exports.setCriterion = async (req, res) => {
    if (!['communication', 'board election', 'members list', 'membership fee', 'events', 'agora attendance', 'development plan', 'fulfilment report'].includes(req.body.antenna_criterion)) {
        return errors.makeValidationError(res, 'This is not a valid criterion.');
    }

    const criterion = req.body.antenna_criterion.replace(/ /g, '_');

    if (!req.permissions.antenna_criteria[criterion]) {
        return errors.makeForbiddenError(res, 'You are not allowed to set fulfilment of the criterion ' + criterion + '.');
    }

    if (req.body.antenna_criterion === 'communication' && req.body.value === 'exception' && !req.permissions.antenna_criteria.communication_exception) {
        return errors.makeForbiddenError(res, 'You are not allowed to give exceptions to the Antenna Criterion `communication`.');
    }

    // The `.upsert()` method returns an object [result, created],
    // where `created` is a boolen whether the result was created or updated
    const result = await AntennaCriterion.upsert(req.body);

    return res.json({
        success: true,
        data: result[0]
    });
};

exports.sendFulfilmentMail = async (req, res) => {
    if (!req.permissions.send_mails) {
        return errors.makeForbiddenError(res, 'You are not allowed to send Antenna Criteria fulfilment mails.');
    }

    let from = constants.FULFILMENT_MAIL_DEFAULT_FROM;
    if (![undefined, null, ''].includes(req.body.from)) {
        if (!isAegeeAddress(req.body.from)) {
            return res.status(422).json({
                success: false,
                errors: { from: ['The sender must be an address on one of these domains: ' + constants.AEGEE_MAIL_DOMAINS.join(', ') + '.'] }
            });
        }

        from = req.body.from;
    }

    await mailer.sendMail({
        from,
        to: req.body.to,
        cc: req.body.cc,
        subject: req.body.subject,
        template: 'custom.html',
        reply_to: req.body.reply_to,
        parameters: { email_body: req.body.body }
    });

    return res.json({
        success: true,
        message: 'Successfully sent Antenna Criteria fulfilment mail',
    });
};
