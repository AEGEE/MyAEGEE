const { faker } = require('@faker-js/faker');
const moment = require('moment');

const { Board, AntennaCriterion, Netcom, MailComponent } = require('../../models');

const notSet = (field) => typeof field === 'undefined';
// A day relative to today in the server's time zone, as the frontend sends it.
const daysFromToday = (days) => moment().add(days, 'days').format('YYYY-MM-DD');

// Random body IDs stay above the bodies used in the core fixtures (e.g. 9 and 34 in
// core-manage-permissions-full.json); otherwise a "no permissions" test fails
// whenever the random ID happens to be a body the test user may manage.
const randomBodyId = () => faker.number.int({ min: 1000, max: 100000 });

exports.generateBoard = (options = {}) => {
    if (notSet(options.body_id)) options.body_id = randomBodyId();
    // Random, but never across a validation boundary: elected before today, the term
    // started in the last days and without an end.
    if (notSet(options.elected_date)) options.elected_date = daysFromToday(-faker.number.int({ min: 1, max: 365 }));
    if (notSet(options.start_date)) options.start_date = daysFromToday(-faker.number.int({ min: 0, max: 5 }));
    if (notSet(options.president)) options.president = faker.number.int({ min: 1, max: 4 });
    if (notSet(options.secretary)) options.secretary = faker.number.int({ min: 1, max: 4 });
    if (notSet(options.treasurer)) options.treasurer = faker.number.int({ min: 1, max: 4 });

    return options;
};

exports.createBoard = (options = {}, createOptions = {}) => {
    return Board.create(exports.generateBoard(options), createOptions);
};

exports.generateAntennaCriterion = (options = {}) => {
    if (notSet(options.agora_id)) options.agora_id = faker.number.int(100);
    if (notSet(options.body_id)) options.body_id = randomBodyId();
    if (notSet(options.antenna_criterion)) options.antenna_criterion = faker.helpers.arrayElement(['communication', 'board election', 'members list', 'membership fee', 'events', 'agora attendance', 'development plan', 'fulfilment report']);

    return options;
};

exports.createAntennaCriterion = (options = {}) => {
    return AntennaCriterion.create(exports.generateAntennaCriterion(options));
};

exports.generateNetcom = (options = {}) => {
    if (notSet(options.body_id)) options.body_id = randomBodyId();
    if (notSet(options.netcom_id)) options.netcom_id = faker.number.int(100);

    return options;
};

exports.createNetcom = (options = {}) => {
    return Netcom.create(exports.generateNetcom(options));
};

exports.generateMailComponent = (options = {}) => {
    if (notSet(options.agora_id)) options.agora_id = faker.number.int(100);
    if (notSet(options.mail_component)) options.mail_component = faker.helpers.arrayElement(['introduction', 'communication', 'board election', 'members list', 'membership fee', 'events', 'agora attendance', 'development plan', 'fulfilment report', 'closing']);
    if (notSet(options.text)) options.text = faker.string.alphanumeric(16);

    return options;
};

exports.createMailComponent = (options = {}) => {
    return MailComponent.create(exports.generateMailComponent(options));
};

exports.clearAll = async () => {
    await Board.destroy({ where: {}, truncate: { cascade: true } });
    await AntennaCriterion.destroy({ where: {}, truncate: { cascade: true } });
    await Netcom.destroy({ where: {}, truncate: { cascade: true } });
    await MailComponent.destroy({ where: {}, truncate: { cascade: true } });
};
