const errors = require('./errors');
const { Candidate, Position, Image } = require('../models');

const core = require('./core');
const helpers = require('./helpers');
const mailer = require('./mailer');
const config = require('../config');

// The fields a candidate sets. The others are set by the server (candidate, position, body name)
// or through their own endpoints (status, image).
const CANDIDATE_FIELDS = [
    'body_id',
    'first_name',
    'last_name',
    'date_of_birth',
    'nationality',
    'languages',
    'studies',
    'member_since',
    'european_experience',
    'local_experience',
    'attended_agorae',
    'attended_epm',
    'attended_conferences',
    'related_experience',
    'external_experience',
    'motivation',
    'program',
    'agreed_to_privacy_policy'
];

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

    const body = req.user.bodies.find((userBody) => userBody.id === Number(req.body.body_id));
    if (!body) {
        return errors.makeForbiddenError(res, 'You cannot apply on behalf of the body you are not a member of.');
    }

    const newCandidate = await Candidate.create({
        ...helpers.whitelistObject(req.body, CANDIDATE_FIELDS),
        body_id: body.id,
        body_name: body.name,
        user_id: req.user.id,
        position_id: req.position.id
    });

    // Send email to JC when a new application is submitted
    await mailer.sendMail({
        to: config.application_notification,
        subject: 'A new application was submitted',
        template: 'candidate_applied.html',
        parameters: {
            position: req.position,
            candidate: newCandidate
        }
    });

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

    const candidate = helpers.whitelistObject(req.body, CANDIDATE_FIELDS);

    // Only a new body is checked, and it has to be one of the candidate's bodies, also when
    // someone else (like the JC) edits the candidature.
    if (candidate.body_id !== undefined && Number(candidate.body_id) !== req.candidate.body_id) {
        const candidateUser = req.candidate.user_id === req.user.id
            ? req.user
            : await core.fetchApplicationUser(req.candidate.user_id);
        const body = (candidateUser.bodies || []).find((candidateBody) => candidateBody.id === Number(candidate.body_id));
        if (!body) {
            return errors.makeForbiddenError(res, 'The candidate is not a member of this body.');
        }

        candidate.body_id = body.id;
        candidate.body_name = body.name;
    }

    await req.candidate.update(candidate);

    return res.json({
        success: true,
        data: req.candidate
    });
};

exports.updateCandidateImage = async (req, res) => {
    // The permission is checked in imageserv.requirePermission before the upload.
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
