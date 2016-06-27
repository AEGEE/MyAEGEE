process.env.NODE_ENV = 'test';

var chai = require('chai');
var chaiHttp = require('chai-http');
var server = require('../lib/server.js');
var mongoose = require('../lib/config/mongo.js');
var should = chai.should();
var Event = require('../lib/eventModel.js');

chai.use(chaiHttp);


describe('Events', function() {
	before(function(done) {
		Event.collection.drop();
		done();
	});

	beforeEach(function(done) {
		// Populate db
		var event = new Event({
			name: "Develop Yourself 2",
			starts: "2015-12-11 15:00",
			ends: "2015-12-14 12:00",
			description: "A training event to boost your self-confidence and teamworking skills",
			organizing_locals: [{foreign_id: "AEGEE-Dresden"}],
			type: "non-statutory",
			max_participants: 22,
			application_deadline: "2015-11-30"
		});

		event.save(function(err) {
			done();
		});
	});

	afterEach(function(done) {
		Event.collection.drop();
		done();
	});

	it('should list ALL events on / GET', function(done) {
		chai.request(server)
			.get('/')
			.end(function(err, res) {
				res.should.have.status(200);
				res.should.be.json;
				res.body.should.be.a('array');
				res.body[0].should.have.property('_id');
				res.body[0].should.have.property('name');
				res.body[0].should.have.property('starts');
				res.body[0].should.have.property('ends');
				res.body[0].should.have.property('application_deadline');
				res.body[0].should.have.property('application_status');
				res.body[0].should.have.property('max_participants');
				res.body[0].should.have.property('status');
				res.body[0].should.have.property('type');
				res.body[0].should.have.property('organizing_locals');
				res.body[0].should.have.property('description');
				res.body[0].should.have.property('url');
				res.body[0].should.have.property('organizer_url');
				res.body[0].should.have.property('application_url');


				done();
			});
	});
});