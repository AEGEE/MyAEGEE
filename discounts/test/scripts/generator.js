const { faker } = require('@faker-js/faker');

const {
    Integration,
    Code,
    Category
} = require('../../models');

const notSet = (field) => typeof field === 'undefined';

exports.generateIntegration = (options = {}) => {
    if (notSet(options.name)) options.name = faker.lorem.sentence();
    if (notSet(options.code)) options.code = faker.lorem.word();
    if (notSet(options.quota_period)) options.quota_period = 'month';
    if (notSet(options.quota_amount)) options.quota_amount = 1;

    return options;
};

exports.generateCode = (options = {}, integration = null) => {
    if (notSet(options.value)) options.value = faker.lorem.word();

    if (integration && integration.id) {
        options.integration_id = integration.id;
    }

    return options;
};

exports.generateDiscount = (options = {}) => {
    if (notSet(options.name)) options.name = faker.lorem.word();
    if (notSet(options.icon)) options.icon = faker.lorem.word();
    if (notSet(options.shortDescription)) options.shortDescription = faker.lorem.sentence();
    if (notSet(options.longDescription)) options.longDescription = faker.lorem.sentence();

    return options;
};

exports.generateCategory = (options = {}) => {
    if (notSet(options.name)) options.name = faker.lorem.word();
    if (notSet(options.discounts)) {
        const discountsCount = Math.round(Math.random() * 5) + 1; // from 1 to 6
        options.discounts = Array.from({ length: discountsCount }, () => exports.generateDiscount());
    }

    return options;
};

exports.createIntegration = (options = {}) => {
    return Integration.create(exports.generateIntegration(options));
};

exports.createCode = (options = {}, integration = null) => {
    return Code.create(exports.generateCode(options, integration));
};

exports.createCategory = (options = {}) => {
    return Category.create(exports.generateCategory(options));
};

exports.clearAll = async () => {
    await Code.destroy({ where: {}, truncate: { cascade: true } });
    await Integration.destroy({ where: {}, truncate: { cascade: true } });
    await Category.destroy({ where: {}, truncate: { cascade: true } });
};
