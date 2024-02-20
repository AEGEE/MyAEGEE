const _ = require('lodash');

const core = require('./core');
const errors = require('./errors');
const mailer = require('./mailer');
const config = require('../config');
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

exports.getMissingMemberslists = async (req, res) => {
    if (!req.permissions.see_missing_memberslist.global) {
        return errors.makeForbiddenError(res, 'You are not allowed to see missing memberslists.');
    }

    const memberslists = await MembersList.findAll({ where: { event_id: req.event.id } });
    const bodies = await core.getBodies(req);

    const missingMemberslists = bodies.filter((body) => !memberslists.find((memberslist) => memberslist.dataValues.body_id === body.id) && ['antenna', 'contact antenna', 'contact'].includes(body.type));

    const filteredMissingMembersLists = [];
    missingMemberslists.forEach((missingMemberslist) => filteredMissingMembersLists.push(_.pick(missingMemberslist, ['id', 'name', 'type'])));

    return res.json({
        success: true,
        data: filteredMissingMembersLists
    });
};

exports.getMemberslistsWithoutFee = async (req, res) => {
    if (!req.permissions.see_memberslist_without_fee.global) {
        return errors.makeForbiddenError(res, 'You are not allowed to see memberslists without fee.');
    }

    const memberslists = await MembersList.findAll({ where: { event_id: req.event.id } });
    const memberslistsWithoutFee = memberslists.filter((memberslist) => memberslist.dataValues.members.every((member) => member.fee === 0));

    const bodies = await core.getBodies(req);

    const bodiesWithoutFee = bodies.filter((body) => memberslistsWithoutFee.find((memberslistWithoutFee) => memberslistWithoutFee.dataValues.body_id === body.id));

    const filteredBodiesWithoutFee = [];
    bodiesWithoutFee.forEach((bodyWithoutFee) => filteredBodiesWithoutFee.push(_.pick(bodyWithoutFee, ['id', 'name', 'type'])));

    return res.json({
        success: true,
        data: filteredBodiesWithoutFee
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

        // Sending the mail to a user.
        await mailer.sendMail({
            to: config.memberslist_notification,
            subject: `A memberslist has been edited for ${req.event.name}`,
            template: 'statutory_memberslist_edited.html',
            parameters: {
                body_name: body.name,
                event_name: req.event.name,
                membership_fee: result.fee_to_aegee
            }
        });

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

    // Sending the mail to a user.
    await mailer.sendMail({
        to: config.memberslist_notification,
        subject: `A memberslist has been submitted for ${req.event.name}`,
        template: 'statutory_memberslist_submitted.html',
        parameters: {
            body_name: body.name,
            event_name: req.event.name,
            membership_fee: newMembersList.fee_to_aegee
        }
    });

    // Calculating votes per antenna.
    await VotesPerAntenna.recalculateVotesForAntenna(body, req.event);

    return res.json({
        success: true,
        data: newMembersList
    });
};
