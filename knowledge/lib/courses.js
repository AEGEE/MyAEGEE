const {
    Course
} = require('../models');
const helpers = require('./helpers');
// const constants = require('./constants');
const errors = require('./errors');

exports.listAllCourses = async (req, res) => {
    if (!req.permissions.hasPermission('view:knowledge')) {
        return errors.makeForbiddenError(res, 'Permission view:knowledge is required, but not present.');
    }

    const result = await Course.findAndCountAll({
        ...helpers.getPagination(req.query),
        order: helpers.getSorting(req.query)
    });

    return res.json({
        success: true,
        data: result.rows,
        meta: { count: result.count }
    });
};

exports.getCourse = async (req, res) => {
    if (!req.permissions.hasPermission('view:knowledge')) {
        return errors.makeForbiddenError(res, 'Permission view:knowledge is required, but not present.');
    }

    return res.json({
        success: true,
        data: req.currentCourse
    });
};

exports.createCourse = async (req, res) => {
    if (!req.permissions.hasPermission('manage:knowledge')) {
        return errors.makeForbiddenError(res, 'Permission manage:knowledge is required, but not present.');
    }

    const course = await Course.create(req.body);

    return res.json({
        success: true,
        data: course
    });
};

exports.updateCourse = async (req, res) => {
    if (!req.permissions.hasPermission('manage:knowledge')) {
        return errors.makeForbiddenError(res, 'Permission manage:knowledge is required, but not present.');
    }

    await req.currentCourse.update(req.body);

    return res.json({
        success: true,
        data: req.currentCourse
    });
};

exports.deleteCourse = async (req, res) => {
    if (!req.permissions.hasPermission('manage:knowledge')) {
        return errors.makeForbiddenError(res, 'Permission manage:knowledge is required, but not present.');
    }

    await req.currentCourse.destroy();

    return res.json({
        success: true,
        message: 'Course is deleted.'
    });
};
