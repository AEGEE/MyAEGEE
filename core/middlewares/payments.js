const { Payment, User, BodyMembership } = require('../models');
const errors = require('../lib/errors');
const helpers = require('../lib/helpers');
const constants = require('../lib/constants');

exports.listAllPayments = async (req, res) => {
    if (!req.permissions.hasPermission('view:payment')) {
        return errors.makeForbiddenError(res, 'Permission view:payment is required, but not present.');
    }

    const result = await Payment.findAndCountAll({
        where: { body_id: req.currentBody.id },
        ...helpers.getPagination(req.query),
        order: helpers.getSorting(req.query)
    });

    return res.json({
        success: true,
        data: result.rows,
        meta: { count: result.count }
    });
};

exports.createPayment = async (req, res) => {
    if (!req.permissions.hasPermission('create:payment')) {
        return errors.makeForbiddenError(res, 'Permission create:payment is required, but not present.');
    }

    const user = await User.findOne({
        where: { id: req.body.user_id },
        include: [BodyMembership]
    });

    if (!user) {
        return errors.makeNotFoundError(res, 'User is not found.');
    }

    if (!user.body_memberships.some((membership) => membership.body_id === req.currentBody.id)) {
        return errors.makeForbiddenError(res, 'User is not a member of a body.');
    }

    const payment = await Payment.create({
        ...req.body,
        user_id: user.id,
        body_id: req.currentBody.id
    });

    return res.json({
        success: true,
        data: payment
    });
};

exports.updatePayment = async (req, res) => {
    if (!req.permissions.hasPermission('update:payment')) {
        return errors.makeForbiddenError(res, 'Permission update:payment is required, but not present.');
    }

    await req.currentPayment.update(req.body, { fields: constants.FIELDS_TO_UPDATE.PAYMENT.UPDATE });
    return res.json({
        success: true,
        data: req.currentPayment
    });
};

exports.deletePayment = async (req, res) => {
    if (!req.permissions.hasPermission('delete:payment')) {
        return errors.makeForbiddenError(res, 'Permission delete:payment is required, but not present.');
    }

    await req.currentPayment.destroy();
    return res.json({
        success: true,
        message: 'Payment is deleted.'
    });
};
