const lodash = require('lodash');

const { MailComponent } = require('../models');
const errors = require('./errors');
const helpers = require('./helpers');

exports.listMailComponents = async (req, res) => {
    if (!req.permissions.send_mails) {
        return errors.makeForbiddenError(res, 'You are not allowed to list mail components.');
    }

    if (!helpers.isNumber(req.params.agora_id)) {
        return errors.makeBadRequestError(res, 'Agora ID is invalid.');
    }

    const components = await MailComponent.findAll({
        where: { agora_id: Number(req.params.agora_id) }
    });

    return res.json({
        success: true,
        data: components
    });
};

exports.setMailComponent = async (req, res) => {
    if (!req.permissions.send_mails) {
        return errors.makeForbiddenError(res, 'You are not allowed to set mail components.');
    }

    if (!helpers.isBodyObject(req.body)) {
        return errors.makeBadRequestError(res, 'The body should be an object.');
    }

    const input = req.body || {};
    if (!['introduction', 'communication', 'board election', 'members list', 'membership fee', 'events', 'agora attendance', 'development plan', 'fulfilment report', 'closing'].includes(input.mail_component)) {
        return errors.makeValidationError(res, 'This is not a valid mail component.');
    }

    // Only the text's fields; the timestamps belong to the service. upsert checks only
    // the fields it gets, so the whole row is checked first.
    const component = lodash.pick(input, ['agora_id', 'mail_component', 'text']);
    await MailComponent.build(component).validate();

    const result = await MailComponent.upsert(component);

    return res.json({
        success: true,
        data: result[0]
    });
};
