const {
    Page
} = require('../models');
const helpers = require('./helpers');
// const constants = require('./constants');
const errors = require('./errors');

exports.listAllPages = async (req, res) => {
    if (!req.permissions.hasPermission('view:knowledge')) {
        return errors.makeForbiddenError(res, 'Permission view:knowledge is required, but not present.');
    }

    const result = await Page.findAndCountAll({
        where: {
            category_id: req.currentCategory.id,
            // TODO: see if we want the filterBy function or just search for ID?
            // ...helpers.filterBy(req.query.query, constants.FIELDS_TO_QUERY.PAGE)
        },
        ...helpers.getPagination(req.query),
        order: helpers.getSorting(req.query)
    });

    return res.json({
        success: true,
        data: result.rows,
        meta: { count: result.count }
    });
};

exports.getPage = async (req, res) => {
    if (!req.permissions.hasPermission('view:knowledge')) {
        return errors.makeForbiddenError(res, 'Permission view:knowledge is required, but not present.');
    }

    return res.json({
        success: true,
        data: req.currentPage
    });
};

exports.createPage = async (req, res) => {
    if (!req.permissions.hasPermission('manage:knowledge')) {
        return errors.makeForbiddenError(res, 'Permission manage:knowledge is required, but not present.');
    }

    const page = await Page.create({
        // TODO: figure out how this works
        category_id: req.currentCategory.id,
    });

    return res.json({
        success: true,
        data: page
    });
};

exports.updatePage = async (req, res) => {
    if (!req.permissions.hasPermission('manage:knowledge')) {
        return errors.makeForbiddenError(res, 'Permission manage:knowledge is required, but not present.');
    }

    await req.currentPage.update({
        // TODO: figure out how this works
    });

    return res.json({
        success: true,
        data: req.currentPage
    });
};

exports.deletePage = async (req, res) => {
    if (!req.permissions.hasPermission('manage:knowledge')) {
        return errors.makeForbiddenError(res, 'Permission manage:knowledge is required, but not present.');
    }

    await req.currentPage.destroy();

    return res.json({
        success: true,
        message: 'Page is deleted.'
    });
};
