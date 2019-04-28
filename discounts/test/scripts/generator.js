const faker = require('faker');

const {
    Integration
} = require('../../models');

const notSet = field => typeof field === 'undefined';

exports.generateIntegration = (options = {}) => {
    if (notSet(options.name)) options.name = faker.lorem.sentence();
    if (notSet(options.code)) options.code = faker.random.word();
    if (notSet(options.quota_period)) options.quota_period = 'month';
    if (notSet(options.quota_amount)) options.quota_amount = 1;

    return options;
};

exports.createIntegration = (options = {}) => {
    return Integration.create(exports.generateIntegration(options), { include: [] });
};

exports.clearAll = async () => {
    await Integration.destroy({ where: {}, truncate: { cascade: true } });
};
