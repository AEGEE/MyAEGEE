process.env.NODE_ENV = 'test';

var chai = require('chai');
var chaiHttp = require('chai-http');
var server = require('../lib/server.js');
var mongoose = require('../lib/config/mongo.js');
var should = chai.should();
var Event = require('../lib/eventModel.js');

chai.use(chaiHttp);


describe('Events Database', require('./test-events-database.js'));

describe('Events Details', require('./test-events-details.js'));

describe('Events Applications', require('./test-events-applications.js'));

describe('Events Organizers', require('./test-events-organizers.js'));
