const faker = require('faker');

const Event = require('../../models/Event');

exports.generateEvent = (options = {}) => {
    if (!options.name) options.name = faker.lorem.sentence();
    if (!options.description) options.description = faker.lorem.paragraph();
    if (!options.application_period_starts) options.application_period_starts = faker.date.future();
    if (!options.application_period_ends) options.application_period_ends = faker.date.future(null, options.application_period_starts);
    if (!options.starts) options.starts = faker.date.future(null, options.application_period_ends);
    if (!options.ends) options.ends = faker.date.future(null, options.starts);
    if (!options.fee) options.fee = faker.random.number(0, 100);
    if (!options.bodies) options.bodies = [faker.random.number(1, 100)];
    if (!options.type) options.type = faker.random.arrayElement(['agora', 'epm']);

    return options;
}

exports.createEvent = (options = {}) => {
    return Event.create(exports.generateEvent(options));
};
