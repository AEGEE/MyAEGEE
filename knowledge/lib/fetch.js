const errors = require('./errors');
const helpers = require('./helpers');
const {
    Course,
    Category,
    Page
} = require('../models');

exports.fetchCourse = async (req, res, next) => {
    // searching the course by id if it's numeric
    if (!helpers.isNumber(req.params.course_id)) {
        return errors.makeBadRequestError(res, 'Course ID is invalid.');
    }

    const course = await Course.findOne({
        where: { id: Number(req.params.course_id) }
    });
    if (!course) {
        return errors.makeNotFoundError(res, 'Course is not found.');
    }

    req.currentCourse = course;

    return next();
};

exports.fetchCategory = async (req, res, next) => {
    // searching the category by id if it's numeric
    if (!helpers.isNumber(req.params.category_id)) {
        return errors.makeBadRequestError(res, 'Category ID is invalid.');
    }

    const category = await Category.findOne({
        where: {
            id: Number(req.params.category_id),
            course_id: Number(req.params.course_id)
        }
    });
    if (!category) {
        return errors.makeNotFoundError(res, 'Category is not found.');
    }

    req.currentCategory = category;
    return next();
};

exports.fetchPage = async (req, res, next) => {
    // searching the page by id if it's numeric
    if (!helpers.isNumber(req.params.page_id)) {
        return errors.makeBadRequestError(res, 'Page ID is invalid.');
    }

    const page = await Page.findOne({
        where: {
            id: Number(req.params.page_id),
            category_id: Number(req.params.category_id)
        }
    });
    if (!page) {
        return errors.makeNotFoundError(res, 'Page is not found.');
    }

    req.currentPage = page;
    return next();
};
