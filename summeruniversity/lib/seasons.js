const errors = require('./errors');
const helpers = require('./helpers');
const { Season } = require('../models');
const { Sequelize, sequelize } = require('./sequelize');

// Fields that can be set when creating or updating a season.
// `active` can only be changed through PUT /seasons/:year/active.
const EDITABLE_FIELDS = [
    'name',
    'event_submission_deadline',
    'application_period_starts',
    'application_period_ends'
];

const findSeason = (year) => {
    const parsed = Number(year);
    if (!Number.isInteger(parsed)) {
        return null;
    }

    return Season.findOne({ where: { year: parsed } });
};

exports.listSeasons = async (req, res) => {
    const seasons = await Season.findAll({ order: [['year', 'DESC']] });

    return res.json({
        success: true,
        data: seasons
    });
};

exports.getActiveSeason = async (req, res) => {
    const season = await Season.findOne({ where: { active: true } });
    if (!season) {
        return errors.makeNotFoundError(res, 'There is no active season.');
    }

    return res.json({
        success: true,
        data: season
    });
};

exports.createSeason = async (req, res) => {
    if (!req.permissions.manage_seasons) {
        return errors.makeForbiddenError(res, 'You are not allowed to manage seasons.');
    }

    // The year can't be changed later, as events refer to the season by its year.
    const season = await Season.create(helpers.whitelistObject(req.body, ['year', ...EDITABLE_FIELDS]));

    return res.status(201).json({
        success: true,
        message: 'Season successfully created.',
        data: season
    });
};

exports.updateSeason = async (req, res) => {
    if (!req.permissions.manage_seasons) {
        return errors.makeForbiddenError(res, 'You are not allowed to manage seasons.');
    }

    const season = await findSeason(req.params.year);
    if (!season) {
        return errors.makeNotFoundError(res, 'Season is not found.');
    }

    await season.update(helpers.whitelistObject(req.body, EDITABLE_FIELDS));

    return res.json({
        success: true,
        message: 'Season successfully updated.',
        data: season
    });
};

exports.setActiveSeason = async (req, res) => {
    if (!req.permissions.manage_seasons) {
        return errors.makeForbiddenError(res, 'You are not allowed to manage seasons.');
    }

    const season = await findSeason(req.params.year);
    if (!season) {
        return errors.makeNotFoundError(res, 'Season is not found.');
    }

    // Deactivating the other season first, so the unique index on the active season holds.
    await sequelize.transaction(async (t) => {
        await Season.update({ active: false }, { where: { active: true, id: { [Sequelize.Op.ne]: season.id } }, transaction: t });
        await season.update({ active: true }, { transaction: t });
    });

    return res.json({
        success: true,
        message: 'Season successfully set as active.',
        data: season
    });
};
