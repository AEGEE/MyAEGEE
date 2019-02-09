const errors = require('./errors');
const { VotesPerAntenna, VotesPerDelegate, Application } = require('../models');

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
        include: [Application]
    });

    return res.json({
        success: true,
        data: votes
    });
};

exports.getVotesPerAntenna = async (req, res) => {
    if (Number.isNaN(Number(req.params.body_id, 10))) {
        return errors.makeBadRequestError(res, 'The body ID is malformed.');
    }

    const votesPerAntenna = await VotesPerAntenna.findOne({
        where: { event_id: req.event.id, body_id: Number(req.params.body_id, 10) }
    });

    const votesPerDelegate = await VotesPerDelegate.findAll({
        where: { event_id: req.event.id, body_id: Number(req.params.body_id, 10) },
        include: [Application]
    });

    return res.json({
        success: true,
        data: {
            antenna: votesPerAntenna,
            delegate: votesPerDelegate
        }
    });
};
