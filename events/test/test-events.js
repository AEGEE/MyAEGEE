process.env.NODE_ENV = 'test';

const chai = require('chai');
const chaiHttp = require('chai-http');

require('../lib/server.js');

chai.use(chaiHttp);

describe('Events listing', require('./test-events-listing.js'));
describe('Events creation', require('./test-events-creation.js'));
describe('Events details', require('./test-events-details.js'));
// describe('Events organizers', require('./test-events-organizers.js'));
// describe('Events applications', require('./test-events-applications.js'));

describe('Lifecycles listing', require('./test-lifecycles-listing.js'));
describe('Lifecycles creation', require('./test-lifecycles-creation.js'));

describe('Options', require('./test-options.js'));
