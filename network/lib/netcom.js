const lodash = require('lodash');

const { Netcom } = require('../models');
const errors = require('./errors');
const helpers = require('./helpers');

exports.listNetcomAssignment = async (req, res) => {
    if (!req.permissions.manage_netcom_assignment) {
        return errors.makeForbiddenError(res, 'You are not allowed to list NetCom assignment.');
    }

    const netcom = await Netcom.findAll();

    return res.json({
        success: true,
        data: netcom
    });
};

exports.setNetcomAssignment = async (req, res) => {
    if (!req.permissions.manage_netcom_assignment) {
        return errors.makeForbiddenError(res, 'You are not allowed to set NetCom assignment.');
    }

    if (!helpers.isBodyObject(req.body)) {
        return errors.makeBadRequestError(res, 'The body should be an object.');
    }

    // Only the assignment's fields; the timestamps belong to the service. upsert checks
    // only the fields it gets, so the whole row is checked first.
    const assignment = lodash.pick(req.body || {}, ['body_id', 'netcom_id']);
    await Netcom.build(assignment).validate();

    const result = await Netcom.upsert(assignment);

    return res.json({
        success: true,
        data: result[0]
    });
};

exports.removeNetcomAssignment = async (req, res) => {
    if (!req.permissions.manage_netcom_assignment) {
        return errors.makeForbiddenError(res, 'You are not allowed to remove NetCom assignment.');
    }

    if (!helpers.isNumber(req.params.body_id)) {
        return errors.makeBadRequestError(res, 'Body ID is invalid.');
    }

    const assignment = await Netcom.findOne({
        where: {
            body_id: Number(req.params.body_id)
        }
    });

    if (!assignment) {
        return errors.makeNotFoundError(res, 'NetCom assignment is not found.');
    }

    await assignment.destroy();

    return res.json({
        success: true,
        message: 'NetCom assignment was deleted.'
    });
};
