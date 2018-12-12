const { errors } = require('oms-common-nodejs');

const { Position } = require('../models');

exports.listAllPositions = async (req, res) => {
    const positions = await Position.findAll({ where: { event_id: req.event.id } });
    return res.json({
        success: true,
        data: positions
    });
};

exports.createPosition = async (req, res) => {
    delete req.body.status;
    req.body.event_id = req.event.id;

    const newEvent = await Position.create(req.body);
    return res.json({
        success: true,
        data: newEvent
    });
};

exports.editPosition = async (req, res) => {
    if (Number.isNaN(Number(req.params.position_id))) {
        return errors.makeBadRequestError(res, 'The position ID is invalid.');
    }

    delete req.body.status;

    const dbResult = await Position.update(req.body, {
        where: { id: Number(req.params.position_id) },
        returning: true
    });

    return res.json({
        success: true,
        data: dbResult[1][0]
    });
};

exports.deletePosition = async (req, res) => {
    if (Number.isNaN(Number(req.params.position_id))) {
        return errors.makeBadRequestError(res, 'The position ID is invalid.');
    }

    const affectedRows = await Position.destroy({ where: { id: Number(req.params.position_id) } });
    if (affectedRows > 0) {
        return res.json({ success: true, message: `The position was deleted` });
    }

    return errors.makeNotFoundError(res, 'Position is not found.');

};

exports.openDeadline = async (req, res) => {
    if (Number.isNaN(Number(req.params.position_id))) {
        return errors.makeBadRequestError(res, 'The position ID is invalid.');
    }

    const position = await Position.findOne({ where: { id: Number(req.params.position_id) } });
    const result = await position.openDeadline(req.body.deadline);

    return res.json({
        success: true,
        data: result
    });
};
