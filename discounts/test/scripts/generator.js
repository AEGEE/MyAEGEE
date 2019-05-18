const faker = require('faker');

const {
    Integration,
    Code,
    Category
} = require('../../models');

const notSet = field => typeof field === 'undefined';

exports.generateIntegration = (options = {}) => {
    if (notSet(options.name)) options.name = faker.lorem.sentence();
    if (notSet(options.code)) options.code = faker.random.word();
    if (notSet(options.quota_period)) options.quota_period = 'month';
    if (notSet(options.quota_amount)) options.quota_amount = 1;

    return options;
};

exports.generateCode = (options = {}, integration = null) => {
    if (notSet(options.value)) options.value = faker.random.word();

    if (integration && integration.id) {
        options.integration_id = integration.id;
    }

    return options;
};

exports.createIntegration = (options = {}) => {
    return Integration.create(exports.generateIntegration(options));
};

exports.createCode = (options = {}, integration = null) => {
    return Code.create(exports.generateCode(options, integration));
};

exports.clearAll = async () => {
    await Code.destroy({ where: {}, truncate: { cascade: true } });
    await Integration.destroy({ where: {}, truncate: { cascade: true } });
};
