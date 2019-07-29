const core = require('./core');
const errors = require('./errors');
const { MembersList, VotesPerAntenna } = require('../models');

exports.checkIfAgora = async (req, res, next) => {
    if (req.event.type !== 'agora') {
        return errors.makeBadRequestError(res, 'You can only access memberslist for Agora.');
    }

    return next();
};

exports.getAllMemberslists = async (req, res) => {
    if (!req.permissions.see_memberslist.global) {
        return errors.makeForbiddenError(res, 'You are not allowed to see memberslists.');
    }

    const memberslists = await MembersList.findAll({ where: { event_id: req.event.id } });
    return res.json({
        success: true,
        data: memberslists
    });
};

exports.getMemberslist = async (req, res) => {
    if (Number.isNaN(parseInt(req.params.body_id, 10))) {
        return errors.makeBadRequestError(res, 'The body_id parameter is invalid.');
    }

    if (!req.permissions.see_memberslist.global && !req.permissions.see_memberslist[req.params.body_id]) {
        return errors.makeForbiddenError(res, 'You are not allowed to see this memberslist.');
    }

    const memberslist = await MembersList.findOne({ where: {
        event_id: req.event.id,
        body_id: parseInt(req.params.body_id, 10)
    } });

    if (!memberslist) {
        return errors.makeNotFoundError(res, 'Members list is not found.');
    }

    return res.json({
        success: true,
        data: memberslist
    });
};

exports.setMemberslistFeePaid = async (req, res) => {
    if (Number.isNaN(parseInt(req.params.body_id, 10))) {
        return errors.makeBadRequestError(res, 'The body_id parameter is invalid.');
    }

    if (!req.permissions.set_memberslists_fee_paid) {
        return errors.makeForbiddenError(res, 'You are not allowed to see this memberslist.');
    }

    const memberslist = await MembersList.findOne({ where: {
        event_id: req.event.id,
        body_id: parseInt(req.params.body_id, 10)
    } });

    if (!memberslist) {
        return errors.makeNotFoundError(res, 'Members list is not found.');
    }

    await memberslist.update({ fee_paid: req.body.fee_paid }, { hooks: false });

    return res.json({
        success: true,
        data: memberslist
    });
};

exports.uploadMembersList = async (req, res) => {
    if (Number.isNaN(parseInt(req.params.body_id, 10))) {
        return errors.makeBadRequestError(res, 'The body_id parameter is invalid.');
    }

    // Fetching body. We'll need that for calculating votes per antenna.
    const body = await core.getBody(req, req.params.body_id);

    req.body.body_id = req.params.body_id;
    req.body.user_id = req.user.id;
    req.body.event_id = req.event.id;

    delete req.body.fee_paid;

    const existingMembersList = await MembersList.findOne({ where: {
        event_id: req.event.id,
        body_id: req.params.body_id
    } });

    if (existingMembersList) {
        if (!req.permissions.edit_memberslist.global && !req.permissions.edit_memberslist[req.params.body_id]) {
            return errors.makeForbiddenError(res, 'You are not allowed to edit memberslist.');
        }

        const result = await existingMembersList.update(req.body);
        // Recalculating votes per antenna.
        await VotesPerAntenna.recalculateVotesForAntenna(body, req.event);

        return res.json({
            success: true,
            data: result
        });
    }

    if (!req.permissions.upload_memberslist.global && !req.permissions.upload_memberslist[req.params.body_id]) {
        return errors.makeForbiddenError(res, 'You are not allowed to upload memberslist.');
    }

    const newMembersList = await MembersList.create(req.body);

    // Calculating votes per antenna.
    await VotesPerAntenna.recalculateVotesForAntenna(body, req.event);

    return res.json({
        success: true,
        data: newMembersList
    });
};
