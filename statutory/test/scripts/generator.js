const faker = require('faker');

const { Event, Application, MembersList } = require('../../models');

const notSet = field => typeof field === 'undefined';

exports.generateEvent = (options = {}) => {
    if (notSet(options.name)) options.name = faker.lorem.sentence();
    if (notSet(options.description)) options.description = faker.lorem.paragraph();
    if (notSet(options.application_period_starts)) options.application_period_starts = faker.date.future();
    if (notSet(options.application_period_ends)) options.application_period_ends = faker.date.future(null, options.application_period_starts);
    if (notSet(options.board_approve_deadline)) options.board_approve_deadline = faker.date.future(null, options.application_period_ends);
    if (notSet(options.starts)) options.starts = faker.date.future(null, options.board_approve_deadline);
    if (notSet(options.ends)) options.ends = faker.date.future(null, options.starts);
    if (notSet(options.fee)) options.fee = faker.random.number({ min: 0, max: 100 });
    if (notSet(options.body_id)) options.body_id = faker.random.number(100);
    if (notSet(options.type)) options.type = faker.random.arrayElement(['agora', 'epm']);

    if (notSet(options.questions)) {
        const questionsCount = Math.round(Math.random() * 5) + 1; // from 1 to 6
        options.questions = Array.from({ length: questionsCount }, () => exports.generateQuestion());
    }

    if (notSet(options.applications)) {
        const applicationsCount = Math.round(Math.random() * 5) + 1; // from 1 to 6
        options.applications = [];

        for (let i = 0; i < applicationsCount; i++) {
            options.applications.push(exports.generateApplication({}, options));
        }
    }

    return options;
};

exports.generateQuestion = (options = {}) => {
    if (notSet(options.description)) options.description = faker.lorem.sentence();
    if (notSet(options.required)) options.required = true;
    if (notSet(options.type)) options.type = 'string';
    if (notSet(options.values) && options.type === 'select') options.values = ['First', 'Second'];

    return options;
};

exports.generateApplication = (options = {}, event = null) => {
    if (notSet(options.user_id)) options.user_id = faker.random.number(100);
    if (notSet(options.body_id)) options.body_id = faker.random.number(100);
    if (notSet(options.board_comment)) options.board_comment = faker.lorem.paragraph();
    if (notSet(options.participant_type)) options.participant_type = faker.random.arrayElement(['delegate', 'visitor', 'observer', 'envoy']);

    if (notSet(options.answers)) {
        const answersCount = event ? event.questions.length : Math.round(Math.random() * 5) + 1; // from 1 to 6
        options.answers = Array.from({ length: answersCount }, () => faker.lorem.sentence());
    }

    if (event && event.id) {
        options.event_id = event.id;
    }

    return options;
};

exports.generateMembersList = (options = {}, event = null) => {
    if (notSet(options.currency)) options.currency = faker.lorem.sentence();
    if (notSet(options.user_id)) options.user_id = faker.random.number(100);
    if (notSet(options.body_id)) options.body_id = faker.random.number(100);
    if (notSet(options.members)) {
        const membersCount = Math.round(Math.random() * 5) + 1; // from 1 to 6
        options.members = Array.from({ length: membersCount }, () => ({
            user_id: faker.random.number(100),
            first_name: faker.name.firstName(),
            last_name: faker.name.lastName(),
            fee: faker.random.number(1000)
        }));
    }

    if (event && event.id) {
        options.event_id = event.id;
    }

    return options;
};

exports.createEvent = (options = {}) => {
    return Event.create(exports.generateEvent(options), { include: [Application] });
};

exports.createApplication = (options = {}, event = null) => {
    return Application.create(exports.generateApplication(options, event));
};

exports.createMembersList = (options = {}, event = null) => {
    return MembersList.create(exports.generateMembersList(options, event));
};

exports.clearAll = async () => {
    await MembersList.destroy({ where: {}, truncate: { cascade: true } });
    await Application.destroy({ where: {}, truncate: { cascade: true } });
    await Event.destroy({ where: {}, truncate: { cascade: true } });
};
