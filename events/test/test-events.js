process.env.NODE_ENV = 'test';

const chai = require('chai');
const chaiHttp = require('chai-http');

require('../lib/server.js');

chai.use(chaiHttp);

describe('Events Listing', require('./test-events-listing.js'));
describe('Events Creation', require('./test-events-creation.js'));
describe('Events Details', require('./test-events-details.js'));
// describe('Events Organizers', require('./test-events-organizers.js'));
// describe('Events Applications', require('./test-events-applications.js'));
describe('Options', require('./test-options.js'));
