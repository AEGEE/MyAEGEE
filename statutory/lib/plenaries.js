const errors = require('./errors');
const { Plenary } = require('../models');

exports.findPlenary = async (req, res, next) => {
    if (Number.isNaN(Number(req.params.plenary_id))) {
        return errors.makeBadRequestError(res, 'The plenary ID is invalid.');
    }

    const plenary = await Plenary.findByPk(Number(req.params.plenary_id));
    if (!plenary) {
        return errors.makeNotFoundError(res, 'Plenary is not found.');
    }

    req.plenary = plenary;
    return next();
};


exports.listAllPlenaries = async (req, res) => {
    if (!req.permissions.see_plenaries) {
        return errors.makeForbiddenError(res, 'You cannot manage plenaries.');
    }

    const plenaries = await Plenary.findAll({
        where: { event_id: req.event.id },
        order: [['created_at', 'ASC']]
    });
    return res.json({
        success: true,
        data: plenaries
    });
};

exports.createPlenary = async (req, res) => {
    if (!req.permissions.manage_plenaries) {
        return errors.makeForbiddenError(res, 'You cannot manage plenaries.');
    }

    req.body.event_id = req.event.id;

    const newPlenary = await Plenary.create(req.body);

    return res.json({
        success: true,
        data: newPlenary
    });
};

exports.editPlenary = async (req, res) => {
    if (!req.permissions.manage_plenaries) {
        return errors.makeForbiddenError(res, 'You cannot manage plenaries.');
    }

    await req.plenary.update(req.body);

    return res.json({
        success: true,
        data: req.plenary
    });
};
