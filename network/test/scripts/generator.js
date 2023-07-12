const { faker } = require('@faker-js/faker');

const { Board } = require('../../models');

const notSet = (field) => typeof field === 'undefined';

exports.generateBoard = (options = {}) => {
    if (notSet(options.body_id)) options.body_id = faker.number.int(100);
    if (notSet(options.elected_date)) options.elected_date = faker.date.past();
    if (notSet(options.start_date)) options.start_date = faker.date.recent({ days: 5 });
    if (notSet(options.president)) options.president = faker.number.int(4);
    if (notSet(options.secretary)) options.secretary = faker.number.int(4);
    if (notSet(options.treasurer)) options.treasurer = faker.number.int(4);

    return options;
};

exports.createBoard = (options = {}) => {
    return Board.create(exports.generateBoard(options));
};

exports.clearAll = async () => {
    await Board.destroy({ where: {}, truncate: { cascade: true } });
};
