const { errors } = require('oms-common-nodejs');

const { Candidate } = require('../models');

exports.submitYourCandidature = async (req, res) => {
    if (!req.permissions.submit_candidature) {
        return errors.makeForbiddenError(res, 'You cannot submit candidature.');
    }

    delete req.body.status;
    delete req.body.user_id;

    req.body.position_id = req.position.id;

    const newCandidate = await Candidate.create(req.body);

    return res.json({
        success: true,
        data: newCandidate
    });
};

exports.editCandidature = async (req, res) => {
    if (!req.permissions.edit_candidature) {
        return errors.makeForbiddenError(res, 'You cannot edit this candidature.');
    }

    delete req.body.status;
    delete req.body.user_id;

    const candidate = await Candidate.findById(Number(req.params.position_id));
    await candidate.update(req.body);

    return res.json({
        success: true,
        data: candidate
    });
};

exports.setCandidatureStatus = async (req, res) => {
    if (!req.permissions.set_candidature_status) {
        return errors.makeForbiddenError(res, 'You cannot update this candidature\'s status.');
    }

    const candidate = await Candidate.findById(Number(req.params.position_id));
    await candidate.update({ status: req.body.status });

    return res.json({
        success: true,
        data: candidate
    });
};
