const core = require('./core');
const errors = require('./errors');
const { PaxLimit } = require('../models');

exports.checkEventType = async (req, res, next) => {
    if (!['agora', 'epm', 'spm'].includes(req.params.event_type)) {
        return errors.makeBadRequestError(res, 'The event type should be one of these: agora, epm, spm.');
    }

    return next();
};

exports.listAllLimits = async (req, res) => {
    // Fetching bodies list
    const bodies = await core.getBodies(req);
    const limits = await PaxLimit.findAll({ where: { event_type: req.params.event_type } });
    const result = bodies.map((body) => {
        const limitPerBody = limits.find(limit => limit.body_id === body.id);

        // Either return a custom limit for a body, or a default one if it's not found.
        return limitPerBody || PaxLimit.getDefaultForBody(body, req.params.event_type);
    });

    return res.json({
        success: true,
        data: result
    });
};

exports.getSingleLimit = async (req, res) => {
    // Fetching bodies list
    const body = await core.getBody(req, req.params.body_id);
    const limit = await PaxLimit.fetchOrUseDefaultForBody(body, req.params.event_type);

    return res.json({
        success: true,
        data: limit
    });
};

exports.updateLimit = async (req, res) => {
    if (!req.permissions.edit_pax_limits[req.params.event_type]) {
        return errors.makeForbiddenError(res, 'You are not allowed to change limits.');
    }

    req.body.event_type = req.params.event_type;
    delete req.body.id;

    let limit = await PaxLimit.findOne({ where: { body_id: req.body.body_id, event_type: req.params.event_type } });
    if (!limit) {
        limit = await PaxLimit.create(req.body);
    } else {
        await limit.update(req.body);
    }

    return res.json({
        success: true,
        data: limit
    });
};

exports.deleteSingleLimit = async (req, res) => {
    if (!req.permissions.edit_pax_limits[req.params.event_type]) {
        return errors.makeForbiddenError(res, 'You are not allowed to change limits.');
    }

    const bodyId = Number(req.params.body_id);
    if (Number.isNaN(bodyId)) {
        return errors.makeBadRequestError(res, 'Body ID should be a number.');
    }

    const affectedRows = await PaxLimit.destroy({ where: { body_id: bodyId, event_type: req.params.event_type } });
    if (affectedRows > 0) {
        return res.json({ success: true, message: `The limit for a body ${bodyId} was deleted, using default one now.` });
    }

    return errors.makeNotFoundError(res, `There's no limit for body with the ID ${bodyId}.`);
};
