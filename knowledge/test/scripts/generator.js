const faker = require('faker');

const {
    Course,
    Chapter,
    Page
} = require('../../models');

const notSet = (field) => typeof field === 'undefined';

exports.generateCourse = (options = {}) => {
    if (notSet(options.name)) options.name = faker.lorem.word();

    return options;
};

exports.generateChapter = (options = {}, course = null) => {
    if (notSet(options.name)) options.name = faker.random.word();

    if (course && course.id) {
        options.course_id = course.id;
    }

    return options;
};

exports.generatePage = (options = {}, chapter = null) => {
    if (notSet(options.name)) options.name = faker.random.word();

    if (chapter && chapter.id) {
        options.chapter_id = chapter.id;
    }

    return options;
};

exports.createCourse = (options = {}) => {
    return Course.create(exports.generateCourse(options));
};

exports.createChapter = (options = {}, course = null) => {
    return Chapter.create(exports.generateChapter(options, course));
};

exports.createPage = (options = {}, chapter = null) => {
    return Page.create(exports.generatePage(options, chapter));
};

exports.clearAll = async () => {
    await Page.destroy({ where: {}, truncate: { cascade: true } });
    await Chapter.destroy({ where: {}, truncate: { cascade: true } });
    await Course.destroy({ where: {}, truncate: { cascade: true } });
};
