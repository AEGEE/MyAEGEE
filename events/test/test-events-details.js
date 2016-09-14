process.env.NODE_ENV = 'test';

var chai = require('chai');
var chaiHttp = require('chai-http');
var server = require('../lib/server.js');
var should = chai.should();
var db = require('./populate-db.js');

module.exports = function() {
	var events;

	beforeEach(function(done) {
		db.clear();
		db.populate(function(res) {
			events = res;
			done();
		});
	});

	it('should return a single event on /single/<eventid> GET', function(done) {
		chai.request(server)
			.get('/single/' + events.event1.id)
			.set('X-Auth-Token', 'foobar')
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

				res.body._id.should.equal(events.event1.id);

				done();
			});
	});

	it('should return a 404 on arbitrary eventids on /single/id GET', function(done) {
		chai.request(server)
			.get('/single/12345')
			.set('X-Auth-Token', 'foobar')
			.end(function(err, res) {
				res.should.have.status(404);
				done();
			});
	});

	it('should update an event on a sane /single/<eventid> PUT', function(done) {
		chai.request(server)
			.put('/single/' + events.event1.id)
			.set('X-Auth-Token', 'foobar')
			.send({
				description: "some new description",
			})
			.end(function(err, res) {
				res.should.have.status(200);
				done();
			});
	});

	it('should store the changes on update after a sane /single/<eventid> PUT', function(done) {
		chai.request(server)
			.put('/single/' + events.event1.id)
			.set('X-Auth-Token', 'foobar')
			.send({
				description: "some new description",
			})
			.end(function(err, res) {
				chai.request(server)
					.get('/single/' + events.event1.id)
					.set('X-Auth-Token', 'foobar')
					.end(function(err, res) {
						res.body.description.should.equal("some new description");
						done();
					});
			});
	});

	it('should ignore superflous fields on overly detailed /single/<eventid> PUT', function(done) {
		chai.request(server)
			.put('/single/' + events.event1.id)
			.set('X-Auth-Token', 'foobar')
			.send({
				applications: [
					{
						first_name: "mallory",
						last_name: "eve",
						foreign_id: "666",
						status: "approved",
					}
				],
			})
			.end(function(err, res) {
				chai.request(server)
					.get('/single/' + events.event1.id)
					.set('X-Auth-Token', 'foobar')
					.end(function(err, res) {
						res.body.applications.forEach(item => {
							item.foreign_id.should.not.equal("666");
						});

						done();
					});
			});
	});

	it('should return a validation error on malformed /single/<eventid> PUT', function(done) {

		chai.request(server)
			.put('/single/' + events.event1.id)
			.set('X-Auth-Token', 'foobar')
			.send({
				ends: "sometime"
			})
			.end(function(err, res) {
				console.log(res.body);
				res.body.should.have.property('errors');
				res.body.errors.should.have.property('ends');
				done();
			});
	});

	it('should not update the organizers list with /single/<eventid> PUT', function(done) {
		chai.request(server)
			.get('/single/' + events.event1.id)
			.set('X-Auth-Token', 'foobar')
			.end(function(err, event) {
				chai.request(server)
					.put('/single/' + events.event1.id)
					.set('X-Auth-Token', 'foobar')
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
							.get('/single/' + events.event1.id)
							.set('X-Auth-Token', 'foobar')
							.end(function(err, res) {
								res.body.organizers.should.deep.equal(event.body.organizers);

								done();
							});
					});
			});
	});

	it('should hide an event from / GET but keep it for /single GET after /single DELETE', function(done) {
		// Delete one event
		chai.request(server)
			.delete('/single/' + events.event1.id)
			.set('X-Auth-Token', 'foobar')
			.end(function(err, res) {
				// Get that single event (should still be possible)
				chai.request(server)
					.get('/single/' + events.event1.id)
					.set('X-Auth-Token', 'foobar')
					.end(function(err, res) {
						res.should.have.status(200);
						res.should.be.json;
						res.should.be.a('object');

						res.body._id.should.equal(events.event1.id);
						res.body.status.should.equal('deleted');

						// Get all again, check if event is still in there
						chai.request(server)
							.get('/')
							.set('X-Auth-Token', 'foobar')
							.end(function(err, res) {
								for (var i=0; i < res.body.length; i++) {
									res.body[i]._id.should.not.equal(events.event1.id);
								}

								done();
							});
					});
			});
	});
}