const faker = require('faker');

const { Event, Application } = require('../../models');
const firstUser = require('../assets/oms-core-valid').data;

const notSet = field => typeof field === 'undefined';

exports.generateEvent = (options = {}) => {
    if (notSet(options.name)) options.name = faker.lorem.sentence();
    if (notSet(options.description)) options.description = faker.lorem.paragraph();
    if (notSet(options.application_starts)) options.application_starts = faker.date.future();
    if (notSet(options.application_ends)) options.application_ends = faker.date.future(null, options.application_starts);
    if (notSet(options.starts)) options.starts = faker.date.future(null, options.application_ends);
    if (notSet(options.ends)) options.ends = faker.date.future(null, options.starts);
    if (notSet(options.type)) options.type = faker.random.arrayElement(['wu', 'es', 'nwm', 'ltc', 'rtc', 'local', 'other']);
    if (notSet(options.fee)) options.fee = faker.random.number({ min: 0, max: 100 });
    if (notSet(options.organizing_bodies)) {
        options.organizing_bodies = [{
            body_id: faker.random.number({ min: 0, max: 100 })
        }];
    }
    if (notSet(options.organizers)) {
        options.organizers = [{
            user_id: firstUser.id,
            first_name: faker.lorem.sentence(),
            last_name: faker.lorem.sentence()
        }];
    }
    if (notSet(options.max_participants)) options.max_participants = faker.random.number({ min: 5, max: 100 });

    return options;
};

exports.createEvent = (options = {}) => {
    return Event.create(exports.generateEvent(options));
};

exports.generateApplication = (options = {}, event) => {
    if (notSet(options.user_id)) options.user_id = faker.random.number(100);
    if (notSet(options.body_id)) options.body_id = faker.random.number(100);
    if (notSet(options.first_name)) options.first_name = faker.lorem.sentence();
    if (notSet(options.last_name)) options.last_name = faker.lorem.sentence();
    if (notSet(options.body_name)) options.body_name = faker.lorem.sentence();

    if (notSet(options.answers)) {
        const answersCount = event ? event.questions.length : Math.round(Math.random() * 5) + 1; // from 1 to 6
        options.answers = Array.from({ length: answersCount }, () => faker.lorem.sentence());
    }

    if (event && event.id) {
        options.event_id = event.id;
    }

    return options;
};

exports.createApplication = (options = {}, event) => {
    return Application.create(exports.generateApplication(options, event));
};

exports.clearAll = async () => {
    await Application.destroy({ where: {}, truncate: { cascade: true } });
    await Event.destroy({ where: {}, truncate: { cascade: true } });
};
