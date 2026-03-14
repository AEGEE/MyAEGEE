const { faker } = require('@faker-js/faker');

const { Event, Application } = require('../../models');

const notSet = (field) => typeof field === 'undefined';

exports.generateEvent = (options = {}) => {
    if (notSet(options.name)) options.name = faker.lorem.words(3);
    if (notSet(options.url)) options.url = `su-${faker.string.alphanumeric(8).toLowerCase()}`;
    if (notSet(options.season)) options.season = 2026;
    if (notSet(options.description)) options.description = faker.lorem.paragraph();
    if (notSet(options.email)) options.email = faker.internet.email();
    if (notSet(options.application_starts)) options.application_starts = faker.date.soon({ days: 10 });
    if (notSet(options.application_ends)) options.application_ends = faker.date.soon({ days: 20, refDate: options.application_starts });
    if (notSet(options.starts)) options.starts = faker.date.soon({ days: 30, refDate: options.application_ends });
    if (notSet(options.ends)) options.ends = faker.date.soon({ days: 40, refDate: options.starts });
    if (notSet(options.theme)) options.theme = faker.lorem.sentence();
    if (notSet(options.theme_implementation)) options.theme_implementation = faker.lorem.paragraph();
    if (notSet(options.fee)) options.fee = 50;
    if (notSet(options.organizing_bodies)) {
        options.organizing_bodies = [{ body_id: 1, body_name: 'AEGEE-Test' }];
    }
    if (notSet(options.cooperation)) options.cooperation = [];
    if (notSet(options.locations)) {
        options.locations = [{
            name: 'Main venue',
            position: { lat: 50.1, lng: 14.4 },
            description: 'Main venue',
            start: true,
            end: true
        }];
    }
    if (notSet(options.theme_category)) options.theme_category = 'leisure';
    if (notSet(options.organizers)) {
        options.organizers = [
            { user_id: 1, body_id: 1, role: 'main_coordinator' },
            { user_id: 2, body_id: 1, role: 'content_manager' },
            { user_id: 3, body_id: 1, role: 'treasurer' },
            { user_id: 4, body_id: 1, role: 'incoming_responsible' }
        ];
    }
    if (notSet(options.questions)) options.questions = [];
    if (notSet(options.max_participants)) options.max_participants = 30;
    if (notSet(options.accepted_participants)) options.accepted_participants = 0;
    if (notSet(options.programme_suct)) options.programme_suct = faker.internet.url();
    if (notSet(options.accommodation_type)) options.accommodation_type = 'Hostel';
    if (notSet(options.agreed_to_su_terms)) options.agreed_to_su_terms = true;

    return options;
};

exports.createEvent = (options = {}) => Event.create(exports.generateEvent(options));

exports.generateApplication = (event, options = {}) => {
    if (notSet(options.user_id)) options.user_id = faker.number.int({ min: 10, max: 1000 });
    if (notSet(options.first_name)) options.first_name = faker.person.firstName();
    if (notSet(options.last_name)) options.last_name = faker.person.lastName();
    if (notSet(options.nationality)) options.nationality = 'NL';
    if (notSet(options.travelling_from)) options.travelling_from = 'Amsterdam';
    if (notSet(options.visa_required)) options.visa_required = false;
    if (notSet(options.body_id)) options.body_id = 1;
    if (notSet(options.body_name)) options.body_name = 'AEGEE-Test';
    if (notSet(options.aegee_experience)) options.aegee_experience = 'A lot';
    if (notSet(options.ideal_su)) options.ideal_su = 'Learning and fun';
    if (notSet(options.motivation)) options.motivation = 'Very motivated';
    if (notSet(options.answers)) options.answers = event ? Array(event.questions.length).fill('answer') : [];
    if (notSet(options.meals)) options.meals = 'vegetarian';
    if (notSet(options.agreed_to_privacy_policy)) options.agreed_to_privacy_policy = true;
    if (notSet(options.agreed_to_su_terms)) options.agreed_to_su_terms = true;
    if (event && event.id) options.event_id = event.id;
    return options;
};

exports.createApplication = (event, options = {}) => Application.create(exports.generateApplication(event, options));

exports.clearAll = async () => {
    await Application.destroy({ where: {}, truncate: { cascade: true } });
    await Event.destroy({ where: {}, truncate: { cascade: true } });
};
