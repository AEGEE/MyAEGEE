const faker = require('faker');

const {
    Course,
    Category,
    Page
} = require('../../models');

const notSet = (field) => typeof field === 'undefined';

exports.generateCourse = (options = {}) => {
    if (notSet(options.name)) options.name = faker.lorem.word();

    return options;
};

exports.generateCategory = (options = {}, course = null) => {
    if (notSet(options.name)) options.name = faker.random.word();

    if (course && course.id) {
        options.course_id = course.id;
    }

    return options;
};

exports.generatePage = (options = {}, category = null) => {
    if (notSet(options.name)) options.name = faker.random.word();
    if (notSet(options.content_type)) options.content_type = faker.random.word();

    if (category && category.id) {
        options.category_id = category.id;
    }

    return options;
};

exports.createCourse = (options = {}) => {
    return Course.create(exports.generateCourse(options));
};

exports.createCategory = (options = {}, course = null) => {
    return Category.create(exports.generateCategory(options, course));
};

exports.createPage = (options = {}, category = null) => {
    return Page.create(exports.generatePage(options, category));
};

exports.clearAll = async () => {
    await Page.destroy({ where: {}, truncate: { cascade: true } });
    await Category.destroy({ where: {}, truncate: { cascade: true } });
    await Course.destroy({ where: {}, truncate: { cascade: true } });
};
