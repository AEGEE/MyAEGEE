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

	it('should list all applications to an event on /single/id/participants/ GET');
	it('should record an application to an event on /single/id/participants/ POST');
	it('should return one specific application on /single/id/participants/id GET');
	it('should edit details of one application on /single/id/participants/id PUT');
}