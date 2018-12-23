const { errors } = require('oms-common-nodejs');
const moment = require('moment');

const { Candidate, Position } = require('../models');
const { Sequelize } = require('./sequelize');

const helpers = require('./helpers');

exports.findCandidate = async (req, res, next) => {
    if (Number.isNaN(Number(req.params.candidate_id))) {
        return errors.makeBadRequestError(res, 'The candidate ID is invalid.');
    }

    const candidate = await Candidate.findByPk(Number(req.params.candidate_id));
    if (!candidate) {
        return errors.makeNotFoundError(res, 'Candidate is not found.');
    }

    req.permissions = helpers.getCandidatePermissions({
        permissions: req.permissions,
        position: req.position,
        candidate,
        user: req.user,
    })

    req.candidate = candidate;
    return next();
};

exports.getMyCandidatures = async (req, res) => {
    const candidatures = await Candidate.findAll({
        where: { user_id: req.user.id },
        include: [Position]
    });

    return res.json({
        success: true,
        data: candidatures
    });
};

exports.submitYourCandidature = async (req, res) => {
    if (!req.permissions.submit_candidature) {
        return errors.makeForbiddenError(res, 'You cannot submit candidature.');
    }

    if (!req.body.body_id || !helpers.isMemberOf(req.user, req.body.body_id)) {
        return errors.makeForbiddenError(res, 'You cannot apply on behalf of the body you are not a member of.');
    }

    delete req.body.status;

    req.body.body_name = req.user.bodies.find(body => body.id === req.body.body_id).name;
    req.body.user_id = req.user.id;
    req.body.position_id = req.position.id;

    const newCandidate = await Candidate.create(req.body);

    // Checking if we have enough candidates and if the deadline has passed.
    // If so, closing the deadline (can reopen manually later).
    const candidatesCount = await Candidate.count({
        where: {
            position_id: req.position.id,
            status: { [Sequelize.Op.ne]: 'rejected' }
        }
    });

    if (candidatesCount > req.position.places && moment().isAfter(req.position.ends)) {
        await req.position.update({ status: 'closed' }, { hooks: false });
    }

    return res.json({
        success: true,
        data: newCandidate
    });
};

exports.getCandidature = async (req, res) => {
    if (req.candidate.user_id !== req.user.id && !req.permissions.edit_candidature) {
        return errors.makeForbiddenError(res, 'You cannot see this candidature.');
    }

    return res.json({
        success: true,
        data: req.candidate
    });
};

exports.editCandidature = async (req, res) => {
    if (!req.permissions.edit_candidature) {
        return errors.makeForbiddenError(res, 'You cannot edit this candidature.');
    }

    delete req.body.status;
    delete req.body.user_id;

    await req.candidate.update(req.body);

    return res.json({
        success: true,
        data: req.candidate
    });
};

exports.setCandidatureStatus = async (req, res) => {
    if (!req.permissions.set_candidature_status) {
        return errors.makeForbiddenError(res, 'You cannot update this candidature\'s status.');
    }

    await req.candidate.update({ status: req.body.status });

    // Checking if we have enough approve candidates and if the deadline has passed.
    // If so, closing the deadline (can reopen manually later).
    const candidatesCount = await Candidate.count({
        where: {
            position_id: req.position.id,
            status: { [Sequelize.Op.ne]: 'rejected' }
        }
    });

    if (moment().isAfter(req.position.ends)) {
        await req.position.update({
            status: candidatesCount > req.position.places ? 'closed' : 'open'
        }, { hooks: false });
    }

    return res.json({
        success: true,
        data: req.candidate
    });
};
