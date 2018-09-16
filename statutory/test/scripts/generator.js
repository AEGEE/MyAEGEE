const faker = require('faker');

const { Event, Application } = require('../../models');

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
    if (!options.questions) {
        const questionsCount = Math.round(Math.random() * 5) + 1; // from 1 to 6
        options.questions = [];

        for (let i = 0; i < questionsCount; i++) {
            options.questions.push(exports.generateQuestion());
        }
    }

    return options;
}

exports.createEvent = (options = {}) => {
    return Event.create(exports.generateEvent(options), { include: Question });
};

exports.clearAll = async () => {
    await Question.destroy({ where: {}, truncate: { cascade: true } });
    await Event.destroy({ where: {}, truncate: { cascade: true } });
};
