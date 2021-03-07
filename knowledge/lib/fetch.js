const errors = require('./errors');
const helpers = require('./helpers');
const {
    Course,
    Chapter,
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

exports.fetchChapter = async (req, res, next) => {
    // searching the chapter by id if it's numeric
    if (!helpers.isNumber(req.params.chapter_id)) {
        return errors.makeBadRequestError(res, 'Chapter ID is invalid.');
    }

    const chapter = await Chapter.findOne({
        where: {
            id: Number(req.params.chapter_id),
            course_id: Number(req.params.course_id)
        }
    });
    if (!chapter) {
        return errors.makeNotFoundError(res, 'Chapter is not found.');
    }

    req.currentChapter = chapter;
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
            chapter_id: Number(req.params.chapter_id)
        }
    });
    if (!page) {
        return errors.makeNotFoundError(res, 'Page is not found.');
    }

    req.currentPage = page;
    return next();
};
