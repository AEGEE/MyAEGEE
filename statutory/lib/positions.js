const { errors } = require('oms-common-nodejs');

const { Position, Candidate } = require('../models');
const helpers = require('./helpers');

exports.findPosition = async (req, res, next) => {
    if (Number.isNaN(Number(req.params.position_id))) {
        return errors.makeBadRequestError(res, 'The position ID is invalid.');
    }

    const position = await Position.findByPk(Number(req.params.position_id));
    if (!position) {
        return errors.makeNotFoundError(res, 'Position is not found.');
    }

    req.permissions = helpers.getPositionPermissions({
        permissions: req.permissions,
        position
    })

    req.position = position;
    return next();
};


exports.listAllPositions = async (req, res) => {
    const positions = await Position.findAll({ where: { event_id: req.event.id } });
    return res.json({
        success: true,
        data: positions
    });
};

exports.listPositionsWithAllCandidates = async (req, res) => {
    if (!req.permissions.manage_candidates) {
        return errors.makeForbiddenError(res, 'You cannot manage positions.');
    }

    const positions = await Position.findAll({
        where: { event_id: req.event.id },
        include: [Candidate]
    });

    return res.json({
        success: true,
        data: positions
    });
};

exports.listPositionsWithApprovedCandidates = async (req, res) => {
    const positions = await Position.findAll({
        where: {
            event_id: req.event.id
        },
        include: [Candidate]
    });

    // Only returning these candidatures which are approved.
    // For those pending (rejected would be filtered out),
    // only the id and the status would be returned.
    // Status is for every position, so we can filter on that
    // on the frontend.
    const filtered = positions.map(position => {
        const jsonPosition = position.toJSON();

        jsonPosition.candidates = position.candidates
            .filter(candidate => candidate.status !== 'rejected')
            .map(candidate => {
                if (candidate.status === 'approved') {
                    return candidate.toJSON();
                }

                return { id: candidate.id, status: candidate.status }
            })

        return jsonPosition;
    })

    return res.json({
        success: true,
        data: filtered
    });
};

exports.createPosition = async (req, res) => {
    if (!req.permissions.manage_candidates) {
        return errors.makeForbiddenError(res, 'You cannot manage positions.');
    }

    delete req.body.status;
    req.body.event_id = req.event.id;

    const newPosition = await Position.create(req.body);

    return res.json({
        success: true,
        data: newPosition
    });
};

exports.editPosition = async (req, res) => {
    if (!req.permissions.manage_candidates) {
        return errors.makeForbiddenError(res, 'You cannot manage positions.');
    }

    await req.position.update(req.body);

    return res.json({
        success: true,
        data: req.position
    });
};
