const moment = require('moment');

const errors = require('./errors');
const { Candidate, Position, Image } = require('../models');

const helpers = require('./helpers');

exports.findCandidate = async (req, res, next) => {
    if (Number.isNaN(Number(req.params.candidate_id))) {
        return errors.makeBadRequestError(res, 'The candidate ID is invalid.');
    }

    const candidate = await Candidate.findOne({
        where: { id: Number(req.params.candidate_id) },
        include: [Image]
    });
    if (!candidate) {
        return errors.makeNotFoundError(res, 'Candidate is not found.');
    }

    req.permissions = helpers.getCandidatePermissions({
        permissions: req.permissions,
        position: req.position,
        candidate,
        user: req.user,
    });

    req.candidate = candidate;
    return next();
};

exports.getMyCandidatures = async (req, res) => {
    const candidatures = await Candidate.findAll({
        where: { user_id: req.user.id },
        include: [Position, Image]
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

    // Closing position immediately if enough candidates.
    const candidatesCount = await Candidate.count({ where: { position_id: req.position.id } });
    if (moment().isAfter(req.position.ends) && candidatesCount > req.position.places) {
        await req.position.update({ status: 'closed' });
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

exports.updateCandidateImage = async (req, res) => {
    if (!req.permissions.edit_candidature) {
        await req.image.destroy();
        return errors.makeForbiddenError(res, 'You cannot edit this candidature.');
    }

    // removing old image
    if (req.candidate.image_id) {
        // first updating the candidate's image to the new one, and then deleting the old one
        // doing it the other way around would violate the foreign key constraint.
        const oldImageId = req.candidate.image_id;
        await req.candidate.update({ image_id: req.image.id });
        await Image.destroy({
            where: { id: oldImageId },
            limit: 1,
            individualHooks: true
        });
    } else {
        await req.candidate.update({ image_id: req.image.id });
    }

    const candidate = req.candidate.toJSON();
    candidate.image = req.image.toJSON();

    return res.json({
        success: true,
        data: candidate
    });
};

exports.setCandidatureStatus = async (req, res) => {
    if (!req.permissions.set_candidature_status) {
        return errors.makeForbiddenError(res, 'You cannot update this candidature\'s status.');
    }

    await req.candidate.update({ status: req.body.status });

    return res.json({
        success: true,
        data: req.candidate
    });
};
