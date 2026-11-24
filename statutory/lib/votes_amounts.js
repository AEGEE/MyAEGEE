const errors = require('./errors');
const constants = require('./constants');
const helpers = require('./helpers');
const { VotesPerAntenna, VotesPerDelegate, Application } = require('../models');

// Every logged-in member can see the votes, so only these fields
// of a delegate's application are returned along with them.
const delegateApplication = {
    model: Application,
    attributes: constants.ALLOWED_VOTES_APPLICATION_FIELDS
};

exports.getAllVotesPerAntenna = async (req, res) => {
    const votes = await VotesPerAntenna.findAll({ where: { event_id: req.event.id } });
    return res.json({
        success: true,
        data: votes
    });
};

exports.getAllVotesPerDelegate = async (req, res) => {
    const votes = await VotesPerDelegate.findAll({
        where: { event_id: req.event.id },
        include: [delegateApplication]
    });

    return res.json({
        success: true,
        data: votes
    });
};

exports.getVotesPerAntenna = async (req, res) => {
    if (!helpers.isNumber(req.params.body_id)) {
        return errors.makeBadRequestError(res, 'The body ID is malformed.');
    }

    const votesPerAntenna = await VotesPerAntenna.findOne({
        where: { event_id: req.event.id, body_id: Number(req.params.body_id) }
    });

    const votesPerDelegate = await VotesPerDelegate.findAll({
        where: { event_id: req.event.id, body_id: Number(req.params.body_id) },
        include: [delegateApplication]
    });

    return res.json({
        success: true,
        data: {
            antenna: votesPerAntenna,
            delegate: votesPerDelegate
        }
    });
};
