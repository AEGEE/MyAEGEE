process.env.NODE_ENV = 'test';

var chai = require('chai');
var chaiHttp = require('chai-http');
var server = require('../lib/server.js');
var mongoose = require('../lib/config/mongo.js');
var should = chai.should();
var Event = require('../lib/eventModel.js');

module.exports = function() {

	before(function(done) {
		Event.collection.drop();
		done();
	});

	beforeEach(function(done) {
		// Populate db
		var event1 = new Event({
			name: "Develop Yourself 2",
			starts: "2015-12-11 15:00",
			ends: "2015-12-14 12:00",
			description: "A training event to boost your self-confidence and teamworking skills",
			organizing_locals: [{foreign_id: "AEGEE-Dresden"}],
			type: "non-statutory",
			max_participants: 22,
			application_deadline: "2015-11-30"
		});

		event1.save(function(err) {
			var event2 = new Event({
				name: "EPM Zagreb",
				starts: "2017-02-23",
				ends: "2017-02-27",
				description: "Drafting the Action Agenda and drinking cheap vodka",
				organizing_locals: [{"foreign_id": "ZAG"},{"foreign_id": "SOF"}],
				type: "statutory",
				max_participants: 300,
				application_deadline: "2017-01-01",
				application_fields : [
					{name: "Motivation"}, 
					{name: "Allergies"}, 
					{name: "Disabilities"}, 
					{name: "TShirt-Size"}, 
					{name: "Meaning of Life"}
				]
			});

			event2.save(function(err) {
				done();
			});
		});
	});

	afterEach(function(done) {
		Event.collection.drop();
		done();
	});

	it('should return a single event on /single/<eventid> GET', function(done) {
		chai.request(server)
			.get('/')
			.end(function(err, event) {
				chai.request(server)
					.get(event.body[0].url)
					.end(function(err, res) {
						res.should.have.status(200);
						res.should.be.json;
						res.should.be.a('object');

						res.body.should.have.property('_id');
						res.body.should.have.property('name');
						res.body.should.have.property('starts');
						res.body.should.have.property('ends');
						res.body.should.have.property('application_status');
						res.body.should.have.property('max_participants');
						res.body.should.have.property('status');
						res.body.should.have.property('type');
						res.body.should.have.property('organizing_locals');
						res.body.should.have.property('description');
						res.body.should.have.property('url');
						res.body.should.have.property('organizer_url');
						res.body.should.have.property('application_url');
						res.body.should.have.property('application_fields');
						res.body.should.have.property('organizers');
						res.body.should.have.property('applications');

						res.body._id.should.equal(event.body[0]._id);

						done();
					});
			});
	});

	it('should return a 404 on arbitrary eventids on /single/id GET', function(done) {
		chai.request(server)
			.get('/single/12345')
			.end(function(err, res) {
				res.should.have.status(404);
				done();
			});
	});

	it('should update an event on a sane /single/<eventid> PUT', function(done) {
		chai.request(server)
			.get('/')
			.end(function(err, event) {
				chai.request(server)
					.put(event.body[0].url)
					.send({
						description: "some new description",
					})
					.end(function(err, res) {

						done();
					});
			});
	});

	it('should store the changes on update after a sane /single/<eventid> PUT', function(done) {
		chai.request(server)
			.get('/')
			.end(function(err, event) {
				chai.request(server)
					.put(event.body[0].url)
					.send({
						description: "some new description",
					})
					.end(function(err, res) {
						chai.request(server)
							.get(event.body[0].url)
							.end(function(err, res) {
								res.body._id.should.equal(event.body[0]._id);
								res.body.description.should.not.equal(event.body[0].description);
								done();
							});
					});
			});
	});

	it('should ignore superflous fields on overly detailed /single/<eventid> PUT', function(done) {
		chai.request(server)
			.get('/')
			.end(function(err, event) {
				chai.request(server)
					.get(event.body[0].url)
					.end(function(err, event) {
						chai.request(server)
							.put(event.body.url)
							.send({
								applications: [
									{
										foreign_id: "mallory.eve",
										status: "approved",
									}
								],
							})
							.end(function(err, res) {
								chai.request(server)
									.get(event.body.url)
									.end(function(err, res) {
										res.body._id.should.equal(event.body._id);
										res.body.applications.should.deep.equal(event.body.applications);

										done();
									});
							});
					});
			});
	});

	it('should return a validation error on malformed /single/<eventid> PUT', function(done) {
		chai.request(server)
			.get('/')
			.end(function(err, event) {
				chai.request(server)
					.put(event.body[0].url)
					.send({
						name: null,
						ends: "sometime"
					})
					.end(function(err, res) {
						res.body.should.have.property('errors');
						res.body.errors.should.have.property('name');
						res.body.errors.should.have.property('ends');
						done();
					});
			});
	});

	it('should not update the organizers list with /single/<eventid> PUT', function(done) {
		chai.request(server)
			.get('/')
			.end(function(err, event) {
				chai.request(server)
					.get(event.body[0].url)
					.end(function(err, event) {
						chai.request(server)
							.put(event.body.url)
							.send({
								organizers: [
									{
										foreign_id: "vincent.vega",
										role: "full",
									}
								],
							})
							.end(function(err, res) {
								chai.request(server)
									.get(event.body.url)
									.end(function(err, res) {
										res.body._id.should.equal(event.body._id);
										res.body.organizers.should.deep.equal(event.body.organizers);

										done();
									});
							});
					});
			});
	});

	it('should hide an event from / GET but keep it for /single GET after /single DELETE', function(done) {
		// Get all events, take first one
		chai.request(server)
			.get('/')
			.end(function(err, event) {
				// Delete that event
				chai.request(server)
					.delete(event.body[0].url)
					.end(function(err, res) {
						// Get that single event (should still be possible)
						chai.request(server)
							.get(event.body[0].url)
							.end(function(err, res) {
								res.should.have.status(200);
								res.should.be.json;
								res.should.be.a('object');

								res.body._id.should.equal(event.body[0]._id);
								res.body.status.should.equal('deleted');

								// Get all again, check if event is still in there
								chai.request(server)
									.get('/')
									.end(function(err, res) {
										for (var i=0; i < res.body.length; i++) {
											res.body[i]._id.should.not.equal(event._id);
										}

										done();  // Christmas, 10 tabs :D
									});
							});
					});
			});
	});
}