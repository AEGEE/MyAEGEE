const { MailComponent } = require('../models');
const errors = require('./errors');

exports.listMailComponents = async (req, res) => {
    if (!req.permissions.send_mails) {
        return errors.makeForbiddenError(res, 'You are not allowed to list mail components.');
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

    if (!['introduction', 'communication', 'board election', 'members list', 'membership fee', 'events', 'agora attendance', 'development plan', 'fulfilment report', 'closing'].includes(req.body.mail_component)) {
        return errors.makeValidationError(res, 'This is not a valid mail component.');
    }

    const result = await MailComponent.upsert(req.body);

    return res.json({
        success: true,
        data: result[0]
    });
};
