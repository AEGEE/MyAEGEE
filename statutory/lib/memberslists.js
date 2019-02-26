const core = require('./core');
const errors = require('./errors');
const { MembersList, VotesPerAntenna } = require('../models');

exports.checkIfAgora = async (req, res, next) => {
    if (req.event.type !== 'agora') {
        return errors.makeBadRequestError(res, 'You can only access memberslust for Agora.');
    }

    return next();
};

exports.getAllMemberslists = async (req, res) => {
    if (!req.permissions.see_memberslists) {
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

    if (!req.permissions.see_memberslists && !req.permissions.upload_memberslist[req.params.body_id]) {
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

exports.uploadMembersList = async (req, res) => {
    if (Number.isNaN(parseInt(req.params.body_id, 10))) {
        return errors.makeBadRequestError(res, 'The body_id parameter is invalid.');
    }

    if (!req.permissions.upload_memberslist[req.params.body_id] && !req.permissions.upload_memberslist_global) {
        return errors.makeForbiddenError(res, 'You are not allowed to upload memberslist.');
    }

    // Fetching body. We'll need that for calculating votes per antenna.
    const body = await core.getBody(req, req.params.body_id);

    req.body.body_id = req.params.body_id;
    req.body.user_id = req.user.id;
    req.body.event_id = req.event.id;

    const existingMembersList = await MembersList.findOne({ where: {
        event_id: req.event.id,
        body_id: req.params.body_id
    } });

    if (existingMembersList) {
        const result = await existingMembersList.update(req.body);
        // Recalculating votes per antenna.
        await VotesPerAntenna.recalculateVotesForAntenna(body, req.event);

        return res.json({
            success: true,
            data: result
        });
    }

    const newMembersList = await MembersList.create(req.body);

    // Calculating votes per antenna.
    await VotesPerAntenna.recalculateVotesForAntenna(body, req.event);

    return res.json({
        success: true,
        data: newMembersList
    });
};
