const { errors } = require('oms-common-nodejs');
const request = require('request-promise-native');

const { PaxLimit } = require('../models');
const config = require('../config');

exports.checkEventType = async (req, res, next) => {
    if (!['agora', 'epm'].includes(req.params.event_type)) {
        return errors.makeBadRequestError(res, 'The event type should be one of these: agora, epm.')
    }

    return next();
}

exports.listAllLimits = async (req, res) => {
    // Fetching bodies list
    const bodies = await request({
        url: config.core.url + ':' + config.core.port + '/bodies',
        method: 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'X-Auth-Token': req.headers['x-auth-token'],
        },
        simple: false,
        json: true
    });

    if (typeof bodies !== 'object') {
        throw new Error('Malformed response when fetching bodies: ' + bodies);
    }

    if (!bodies.success) {
        throw new Error('Error fetching bodies: ' + JSON.stringify(bodies));
    }

    const limits = await PaxLimit.findAll({ where: { event_type: req.params.event_type } });
    const result = bodies.data.map((body) => {
        const limitPerBody = limits.find(limit => limit.body_id === body.id);

        // Either return a custom limit for a body, or a default one if it's not found.
        return limitPerBody ? limitPerBody : PaxLimit.getDefaultForBody(body, req.params.event_type);
    });

    return res.json({
        success: true,
        data: result
    });
};

exports.getSingleLimit = async (req, res) => {
    // Fetching bodies list
    const body = await request({
        url: config.core.url + ':' + config.core.port + '/bodies/' + req.params.body_id,
        method: 'GET',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'X-Auth-Token': req.headers['x-auth-token'],
        },
        simple: false,
        json: true
    });

    if (typeof body !== 'object') {
        throw new Error('Malformed response when fetching body: ' + body);
    }

    if (!body.success) {
        // We are not authenticated
        throw new Error('Error fetching body: ' + JSON.stringify(body));
    }

    const limit = await PaxLimit.fetchOrUseDefaultForBody(body.data, req.params.event_type);


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

    const limit = await PaxLimit.upsert(req.body, { returning: true });
    return res.json({
        success: true,
        data: limit[0]
    })
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
