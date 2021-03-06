const {
    Category
} = require('../models');
const helpers = require('./helpers');
// const constants = require('./constants');
const errors = require('./errors');

exports.listAllCategories = async (req, res) => {
    if (!req.permissions.hasPermission('view:knowledge')) {
        return errors.makeForbiddenError(res, 'Permission view:knowledge is required, but not present.');
    }

    const result = await Category.findAndCountAll({
        where: {
            course_id: req.currentCourse.id,
            // TODO: see if we want the filterBy function or just search for ID?
            // ...helpers.filterBy(req.query.query, constants.FIELDS_TO_QUERY.CATEGORY)
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

exports.getCategory = async (req, res) => {
    if (!req.permissions.hasPermission('view:knowledge')) {
        return errors.makeForbiddenError(res, 'Permission view:knowledge is required, but not present.');
    }

    return res.json({
        success: true,
        data: req.currentCategory
    });
};

exports.createCategory = async (req, res) => {
    if (!req.permissions.hasPermission('manage:knowledge')) {
        return errors.makeForbiddenError(res, 'Permission manage:knowledge is required, but not present.');
    }

    const category = await Category.create({
        // TODO: figure out how this works
        course_id: req.currentCourse.id,
    });

    return res.json({
        success: true,
        data: category
    });
};

exports.updateCategory = async (req, res) => {
    if (!req.permissions.hasPermission('manage:knowledge')) {
        return errors.makeForbiddenError(res, 'Permission manage:knowledge is required, but not present.');
    }

    await req.currentCategory.update({
        // TODO: figure out how this works
    });

    return res.json({
        success: true,
        data: req.currentCategory
    });
};

exports.deleteCategory = async (req, res) => {
    if (!req.permissions.hasPermission('manage:knowledge')) {
        return errors.makeForbiddenError(res, 'Permission manage:knowledge is required, but not present.');
    }

    await req.currentCategory.destroy();

    return res.json({
        success: true,
        message: 'Category is deleted.'
    });
};
