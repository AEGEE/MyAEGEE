const { AntennaCriterion } = require('../models');
const errors = require('./errors');
const helpers = require('./helpers');
const mailer = require('./mailer');
const constants = require('./constants');

// One address without a display name: a dot-atom local part (RFC 5322, no quoted
// strings) and a domain of at least two labels. Neither part can hold whitespace, so
// a CR or LF never gets through.
const LOCAL_PART = "[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*";
const DOMAIN_LABEL = '[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?';
const EMAIL_REGEX = new RegExp(`^(${LOCAL_PART})@(${DOMAIN_LABEL}(?:\\.${DOMAIN_LABEL})+)$`);

const parseAddress = (value) => {
    if (typeof value !== 'string' || value.length > 254) {
        return null;
    }

    const match = EMAIL_REGEX.exec(value);
    if (!match || match[1].length > 64) {
        return null;
    }

    return { local: match[1], domain: match[2].toLowerCase() };
};

const isAddress = (value) => parseAddress(value) !== null;

const isAegeeAddress = (value) => {
    const address = parseAddress(value);
    return address !== null && constants.AEGEE_MAIL_DOMAINS.includes(address.domain);
};

// One address, or a non-empty list of them.
const isAddressList = (value) => {
    const list = Array.isArray(value) ? value : [value];
    return list.length > 0 && list.every(isAddress);
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

const isFilledString = (value) => typeof value === 'string' && value.trim() !== '';
const isEmpty = (value) => value === undefined || value === null || value === '';

// Checks the fulfilment mail request and returns the errors per field. Every header
// field (sender, recipients, reply-to, subject) is one line; only the text may span lines.
const validateFulfilmentMail = (input) => {
    const fieldErrors = {};

    if (!isEmpty(input.from) && !isAegeeAddress(input.from)) {
        fieldErrors.from = ['The sender must be an address on one of these domains: ' + constants.AEGEE_MAIL_DOMAINS.join(', ') + '.'];
    }

    if (!isAddressList(input.to)) {
        fieldErrors.to = ['The recipient must be an address or a list of addresses.'];
    }

    if (!isEmpty(input.cc) && !isAddressList(input.cc)) {
        fieldErrors.cc = ['Cc must be an address or a list of addresses.'];
    }

    if (!isEmpty(input.reply_to) && !isAddress(input.reply_to)) {
        fieldErrors.reply_to = ['Reply-to must be an address.'];
    }

    if (!isFilledString(input.subject)) {
        fieldErrors.subject = ['The subject must be set.'];
    } else if (/[\r\n]/.test(input.subject)) {
        fieldErrors.subject = ['The subject must be one line.'];
    }

    if (!isFilledString(input.body)) {
        fieldErrors.body = ['The mail text must be set.'];
    }

    return fieldErrors;
};

exports.sendFulfilmentMail = async (req, res) => {
    if (!req.permissions.send_mails) {
        return errors.makeForbiddenError(res, 'You are not allowed to send Antenna Criteria fulfilment mails.');
    }

    const input = req.body || {};
    const fieldErrors = validateFulfilmentMail(input);
    if (Object.keys(fieldErrors).length > 0) {
        return res.status(422).json({ success: false, errors: fieldErrors });
    }

    await mailer.sendMail({
        from: isEmpty(input.from) ? constants.FULFILMENT_MAIL_DEFAULT_FROM : input.from,
        to: input.to,
        cc: input.cc,
        subject: input.subject,
        template: 'custom.html',
        reply_to: input.reply_to,
        parameters: { email_body: input.body }
    });

    return res.json({
        success: true,
        message: 'Successfully sent Antenna Criteria fulfilment mail',
    });
};
