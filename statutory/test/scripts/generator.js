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
        options.questions = Array.from({ length: questionsCount }, () => faker.lorem.sentence());
    }

    if (!options.applications) {
        const applicationsCount = Math.round(Math.random() * 5) + 1; // from 1 to 6
        options.applications = [];

        for (let i = 0; i < applicationsCount; i++) {
            options.applications.push(exports.generateApplication());
        }
    }

    return options;
}

exports.generateApplication = (options = {}) => {
    if (!options.user_id) options.user_id = faker.random.number(1, 100);
    if (!options.body_id) options.body_id = faker.random.number(1, 100);
    if (!options.board_comment) options.board_comment = faker.lorem.paragraph();
    if (!options.participant_type) options.participant_type = faker.random.arrayElement(['delegate', 'visitor', 'observer', 'envoy']);

    if (!options.answers) {
        const answersCount = Math.round(Math.random() * 5) + 1; // from 1 to 6
        options.answers = Array.from({ length: answersCount }, () => faker.lorem.sentence());
    }

    return options;
}

exports.createEvent = (options = {}) => {
    return Event.create(exports.generateEvent(options), { include: [ Application ] });
};

exports.clearAll = async () => {
    await Application.destroy({ where: {}, truncate: { cascade: true } });
    await Event.destroy({ where: {}, truncate: { cascade: true } });
};
