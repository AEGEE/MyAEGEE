const {
    Chapter
} = require('../models');
const helpers = require('./helpers');
const errors = require('./errors');

exports.listAllChapters = async (req, res) => {
    if (!req.permissions.hasPermission('view:knowledge')) {
        return errors.makeForbiddenError(res, 'Permission view:knowledge is required, but not present.');
    }

    const result = await Chapter.findAndCountAll({
        where: {
            course_id: req.currentCourse.id
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

exports.getChapter = async (req, res) => {
    if (!req.permissions.hasPermission('view:knowledge')) {
        return errors.makeForbiddenError(res, 'Permission view:knowledge is required, but not present.');
    }

    return res.json({
        success: true,
        data: req.currentChapter
    });
};

exports.createChapter = async (req, res) => {
    if (!req.permissions.hasPermission('manage:knowledge')) {
        return errors.makeForbiddenError(res, 'Permission manage:knowledge is required, but not present.');
    }

    const chapter = await Chapter.create({
        ...req.body,
        course_id: req.currentCourse.id
    });

    return res.json({
        success: true,
        data: chapter
    });
};

exports.updateChapter = async (req, res) => {
    if (!req.permissions.hasPermission('manage:knowledge')) {
        return errors.makeForbiddenError(res, 'Permission manage:knowledge is required, but not present.');
    }

    await req.currentChapter.update(req.body);

    return res.json({
        success: true,
        data: req.currentChapter
    });
};

exports.deleteChapter = async (req, res) => {
    if (!req.permissions.hasPermission('manage:knowledge')) {
        return errors.makeForbiddenError(res, 'Permission manage:knowledge is required, but not present.');
    }

    await req.currentChapter.destroy();

    return res.json({
        success: true,
        message: 'Chapter is deleted.'
    });
};
