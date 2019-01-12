const faker = require('faker');

const mongoose = require('../../lib/config/mongo');
const Event = require('../../lib/models/Event');
const firstUser = require('../assets/oms-core-valid').data;
const secondUser = require('../assets/oms-core-valid-not-superadmin').data;

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
  if (notSet(options.organizing_locals)) options.organizing_locals = [{
    body_id: faker.random.number({ min: 0, max: 100 })
  }];
  if (notSet(options.organizers)) options.organizers = [{
    user_id: firstUser.id
  }];
  if (notSet(options.max_participants)) options.max_participants = faker.random.number({ min: 5, max: 100 });

  return options;
}

exports.createEvent = (options = {}) => {
  const event = new Event(exports.generateEvent(options));
  return event.save();
}

exports.clear = async () => {
  await mongoose.connection.dropDatabase();
};
