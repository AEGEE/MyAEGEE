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
			application_deadline: "2015-11-30",
			application_status: "closed",
			organizers: [{foreign_id: "cave.johnson"}],
			application_fields : [
					{name: "Motivation"},
					{name: "TShirt-Size"}, 
					{name: "Meaning of Life"},
					{name: "Allergies"}
			],
		});

		event1.save(function(err, event1) {
			event1.applications = [
				{
					foreign_id: "vincent.vega",
					application_status: "approved",
					application: [
						{
							field_id: event1.application_fields[0]._id,
							value: "I am unmotivated"
						}, {
							field_id: event1.application_fields[1]._id,
							value: "L"
						}, {
							field_id: event1.application_fields[3]._id,
							value: "lactose, gluten"
						}
					]
				}, {
					foreign_id: "jules.winnfield",
					application_status: "requesting",
					application: []
				}
			]

			event1.save(function(err) {
				var event2 = new Event({
					name: "EPM Zagreb",
					starts: "2017-02-23",
					ends: "2017-02-27",
					description: "Drafting the Action Agenda and drinking cheap vodka",
					organizing_locals: [{"foreign_id": "ZAG"},{"foreign_id": "SOF"}],
					type: "statutory",
					status: "approved",
					max_participants: 300,
					application_deadline: "2017-01-01",
					application_status: "open",
					application_fields : [
						{name: "Motivation"}, 
						{name: "Allergies"}, 
						{name: "Disabilities"}, 
						{name: "TShirt-Size"}, 
						{name: "Meaning of Life"}
					],
					organizers: [{foreign_id: "vincent.vega"}],
				});

				event2.save(function(err, event2) {
					event2.applications = [
						{
							foreign_id: "vincent.vega",
							application_status: "approved",
							application: [
								{
									field_id: event2.application_fields[0]._id,
									value: "I am unmotivated"
								}, {
									field_id: event2.application_fields[3]._id,
									value: "L"
								}, {
									field_id: event2.application_fields[1]._id,
									value: "lactose, gluten"
								}
							]
						}		
					];
					event2.save(function(err) {
						done();
					});
				});
			});
		});
	});

	afterEach(function(done) {
		Event.collection.drop();
		done();
	});

	it('should list all applications to an event on /single/id/participants/ GET', function(done) {
		chai.request(server)
			.get('/')
			.end(function(err, event) {
				var closedEvent = event.body.find(function(x) {return x.application_status == 'closed';});
				closedEvent.should.be.ok;
				chai.request(server)
					.get(closedEvent.application_url)
					.end(function(err, res) {
						res.should.have.status(200);
						res.should.be.json;
						res.body.should.be.a('array');

						res.body.should.have.lengthOf(2);
						done();
					});
			});
	});


	it('should record an application to an event on /single/id/participants/ POST', function(done) {
		chai.request(server)
			.get('/')
			.end(function(err, event) {
				var openEvent = event.body.find(function(x) {return x.application_status == 'open';});
				openEvent.should.be.ok;
				chai.request(server)
					.get(openEvent.url)
					.end(function(err, event) {
						chai.request(server)
							.post(event.body.application_url)
							.send({
								application: [
									{
										field_id: event.body.application_fields[0]._id,
										value: "I am super motivated"
									}, {
										field_id: event.body.application_fields[2]._id,
										value: "42"
									}
								]
							})
							.end(function(err, res) {
								res.should.have.status(201);

								Event.findById(event.body._id).exec(function(err, savedEvent) {
									savedEvent.applications.should.be.a('array');
									var ownUserID = 'cave.johnson';
									var ownApplication = savedEvent.applications.find(function(x) {return x.foreign_id==ownUserID;});
									ownApplication.should.be.ok;
									ownApplication.application.should.be.a('array');
									ownApplication.application.should.have.lengthOf(2);

									done();
								});
							});
					});
			});
	});

	it('should return one specific application on /single/id/participants/id GET', function(done) {
		chai.request(server)
			.get('/')
			.end(function(err, event) {
				var openEvent = event.body.find(function(x) {return x.application_status == 'open';});
				openEvent.should.be.ok;
				chai.request(server)
					.get(openEvent.url)
					.end(function(err, event) {
						chai.request(server)
							.get(event.body.application_url + '/vincent.vega')
							.end(function(err, res) {
								res.should.have.status(200);
								done();
							});
					});
			});
	});


	it('should edit details of one application on /single/id/participants/id PUT');
}