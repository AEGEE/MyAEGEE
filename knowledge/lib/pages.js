const { Page } = require('../models');
const helpers = require('./helpers');
const errors = require('./errors');

exports.listAllPages = async (req, res) => {
    if (!req.permissions.view_knowledge) {
        return errors.makeForbiddenError(res, 'Permission view:knowledge is required, but not present.');
    }

    const result = await Page.findAndCountAll({
        where: {
            chapter_id: req.currentChapter.id
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
    if (!req.permissions.view_knowledge) {
        return errors.makeForbiddenError(res, 'Permission view:knowledge is required, but not present.');
    }

    return res.json({
        success: true,
        data: req.currentPage
    });
};

exports.createPage = async (req, res) => {
    if (!req.permissions.manage_knowledge) {
        return errors.makeForbiddenError(res, 'Permission manage:knowledge is required, but not present.');
    }

    const page = await Page.create({
        ...req.body,
        chapter_id: req.currentChapter.id
    });

    return res.json({
        success: true,
        data: page
    });
};

exports.updatePage = async (req, res) => {
    if (!req.permissions.manage_knowledge) {
        return errors.makeForbiddenError(res, 'Permission manage:knowledge is required, but not present.');
    }

    await req.currentPage.update(req.body);

    return res.json({
        success: true,
        data: req.currentPage
    });
};

exports.deletePage = async (req, res) => {
    if (!req.permissions.manage_knowledge) {
        return errors.makeForbiddenError(res, 'Permission manage:knowledge is required, but not present.');
    }

    await req.currentPage.destroy();

    return res.json({
        success: true,
        data: req.currentPage
    });
};
