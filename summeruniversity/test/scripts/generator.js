const { faker } = require('@faker-js/faker');

const { Event, Application, Season } = require('../../models');
const firstUser = require('../assets/oms-core-valid.json').data;

const notSet = (field) => typeof field === 'undefined';
const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (days) => new Date(Date.now() + days * DAY);

exports.daysFromNow = daysFromNow;

// The organizers schema requires at least 4 organizers with user_id and role.
exports.generateOrganizers = (mainUserId = firstUser.id) => [
    { user_id: mainUserId, body_id: 34, role: 'main_coordinator' },
    { user_id: 1001, role: 'content_manager' },
    { user_id: 1002, role: 'treasurer' },
    { user_id: 1003, role: 'incoming_responsible' }
];

// By default generates an event that is fully published, approved and open for applications.
exports.generateEvent = (options = {}) => {
    if (notSet(options.name)) options.name = faker.lorem.sentence();
    if (notSet(options.description)) options.description = faker.lorem.paragraph();
    if (notSet(options.email)) options.email = faker.internet.email();
    if (notSet(options.season)) options.season = 2026;
    if (notSet(options.application_starts)) options.application_starts = daysFromNow(-1);
    if (notSet(options.application_ends)) options.application_ends = daysFromNow(30);
    if (notSet(options.starts)) options.starts = daysFromNow(60);
    if (notSet(options.ends)) options.ends = new Date(new Date(options.starts).getTime() + 10 * DAY);
    if (notSet(options.type)) options.type = 'regular';
    if (notSet(options.theme_category)) options.theme_category = 'leisure';
    if (notSet(options.theme)) options.theme = faker.lorem.sentence();
    if (notSet(options.theme_implementation)) options.theme_implementation = faker.lorem.sentence();
    if (notSet(options.learning_objectives)) options.learning_objectives = [faker.lorem.sentence(), faker.lorem.sentence()];
    if (notSet(options.fee)) options.fee = faker.number.int({ min: 0, max: 100 });
    if (notSet(options.optional_fee)) options.optional_fee = faker.number.int({ min: 0, max: 20 });
    if (notSet(options.organizing_bodies)) options.organizing_bodies = [{ body_id: 34, body_name: 'AEGEE-Alicante' }];
    if (notSet(options.locations)) options.locations = [{ name: faker.location.city(), position: { lat: 1, lng: 2 } }];
    if (notSet(options.organizers)) options.organizers = exports.generateOrganizers();
    if (notSet(options.max_participants)) options.max_participants = faker.number.int({ min: 15, max: 100 });
    if (notSet(options.accepted_participants)) options.accepted_participants = 0;
    if (notSet(options.programme_suct)) options.programme_suct = faker.internet.url();
    if (notSet(options.accommodation_type)) options.accommodation_type = faker.lorem.word();
    if (notSet(options.agreed_to_su_terms)) options.agreed_to_su_terms = true;
    if (notSet(options.questions)) options.questions = [{ description: faker.lorem.sentence() }];
    if (notSet(options.status)) options.status = 'second approval';
    if (notSet(options.published)) options.published = 'full';

    return options;
};

exports.createEvent = (options = {}) => Event.create(exports.generateEvent(options));

// Generates the request body for an application, without user/event fields set by the server.
exports.generateApplicationBody = (event, options = {}) => {
    if (notSet(options.body_id)) options.body_id = 34;
    if (notSet(options.nationality)) options.nationality = faker.location.country();
    if (notSet(options.travelling_from)) options.travelling_from = faker.location.city();
    if (notSet(options.meals)) options.meals = 'vegetarian';
    if (notSet(options.aegee_experience)) options.aegee_experience = faker.lorem.sentence();
    if (notSet(options.ideal_su)) options.ideal_su = faker.lorem.sentence();
    if (notSet(options.motivation)) options.motivation = faker.lorem.sentence();
    if (notSet(options.agreed_to_privacy_policy)) options.agreed_to_privacy_policy = true;
    if (notSet(options.agreed_to_su_terms)) options.agreed_to_su_terms = true;
    if (notSet(options.answers)) {
        const answersCount = event && Array.isArray(event.questions) ? event.questions.length : 1;
        options.answers = Array.from({ length: answersCount }, () => faker.lorem.sentence());
    }

    return options;
};

exports.generateApplication = (event, options = {}) => {
    if (notSet(options.user_id)) options.user_id = faker.number.int({ min: 2000, max: 1000000 });
    if (notSet(options.first_name)) options.first_name = faker.person.firstName();
    if (notSet(options.last_name)) options.last_name = faker.person.lastName();
    if (notSet(options.body_name)) options.body_name = 'AEGEE-Alicante';

    exports.generateApplicationBody(event, options);

    if (event && event.id) {
        options.event_id = event.id;
    }

    return options;
};

exports.createApplication = (event, options = {}) => Application.create(exports.generateApplication(event, options));

exports.clearAll = async () => {
    await Application.destroy({ where: {}, truncate: { cascade: true } });
    await Event.destroy({ where: {}, truncate: { cascade: true } });

    // Back to the 2026 season that the migration creates.
    await Season.destroy({ where: {}, truncate: true });
    await Season.create({ year: 2026, name: 'Summer University 2026', active: true });
};

exports.createSeason = (options = {}) => {
    if (notSet(options.year)) options.year = faker.number.int({ min: 2030, max: 2999 });
    if (notSet(options.name)) options.name = 'Summer University ' + options.year;

    return Season.create(options);
};

// Makes the season with this year the only active one.
exports.activateSeason = async (year) => {
    await Season.update({ active: false }, { where: {} });
    await Season.update({ active: true }, { where: { year } });
};

// A valid request body for POST / (event creation).
exports.generateEventBody = (options = {}) => {
    const body = exports.generateEvent(options);
    delete body.status;
    delete body.published;
    delete body.accepted_participants;

    return JSON.parse(JSON.stringify(body));
};
