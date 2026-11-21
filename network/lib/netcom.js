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

    const result = await Netcom.upsert(req.body);

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
