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
			organizers: [{foreign_id: "vincent.vega"}],
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
				],
				organizers: [{foreign_id: "vincent.vega"}],
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


	it('should list all contributing organizers on /single/id/organizers GET', function(done) {
		chai.request(server)
			.get('/')
			.end(function(err, event) {
				chai.request(server)
					.get(event.body[0].organizer_url)
					.end(function(err, res) {
						res.should.have.status(200);
						res.should.be.json;
						res.body.should.be.a('array');

						res.body.length.should.be.at.least(1);

						done();
					});
			});
	});


	it('should change the organizers list on /single/id/organizers PUT', function(done){
		chai.request(server)
			.get('/')
			.end(function(err, event) {
				chai.request(server)
					.put(event.body[0].organizer_url)
					.send({organizers: [
						{
							foreign_id: "cave.johnson",
							role: "full"
						}, {
							foreign_id: "vincent.vega",
							role: "full"
						}
					]})
					.end(function(err, res) {
						res.should.have.status(200);

						chai.request(server)
							.get(event.body[0].organizer_url)
							.end(function(err, res) {
								res.should.have.status(200);
								res.should.be.json;
								res.body.should.be.a('array');

								res.body.should.have.lengthOf(2);
								res.body[0].foreign_id.should.equal("cave.johnson");
								res.body[1].foreign_id.should.equal("vincent.vega");

								done();
							});
					});
			});	
	});


}