process.env.NODE_ENV = 'test';

var mongoose = require('../lib/config/mongo.js');
var Event = require('../lib/eventModel.js');

exports.populate = function(callback) {
	var now = new Date();

	var event1 = new Event({
		name: "Develop Yourself 4",
		starts: now.getDate()+14,
		ends: now.getDate()+15,
		description: "A training event to boost your self-confidence and teamworking skills",
		organizing_locals: [{
			foreign_id: "1",
			name: "AEGEE-Dresden"
		}],
		type: "non-statutory",
		status: "draft",
		max_participants: 22,
		application_deadline: now.getDate()+13,
		application_status: "closed",
		organizers: [{
			first_name: "Cave",
			last_name: "Johnson",
			foreign_id: "1"
		}],
	});

	event1.save(function(err, event1) {
		if(err) {
			console.log(err);
			throw err;
		}

		var event2 = new Event({
			name: "EPM Zagreb",
			starts: "2017-02-23",
			ends: "2017-02-27",
			description: "Drafting the Action Agenda and drinking cheap vodka",
			organizing_locals: [
				{foreign_id: "2", name: "AEGEE-Zagreb"},
				{foreign_id: "3", name: "AEGEE-Somethingelse"}
			],
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
			organizers: [{
				first_name: "Vincent",
				last_name: "Vega",
				foreign_id: "2"
			}],
		});


		event2.save(function(err, event2) {
			if(err) {
				console.log(err);
				throw err;
			}

			var event3 = new Event({
				name: "NWM-Manchester",
				starts: "2017-12-11 15:00",
				ends: "2017-12-14 12:00",
				description: "A training event to boost your self-confidence and teamworking skills",
				organizing_locals: [{foreign_id: "AEGEE-Dresden"}],
				type: "non-statutory",
				status: "approved",
				max_participants: 22,
				application_deadline: "2017-11-30",
				application_status: "open",
				organizers: [{foreign_id: "cave.johnson"}],
				application_fields : [
						{name: "Motivation"},
						{name: "TShirt-Size"}, 
						{name: "Meaning of Life"},
						{name: "Allergies"}
				],
			});

			event3.save(function(err, event3) {
				if(err){
					console.log(err);
					throw err;
				}
				event3.applications = [
					{
						first_name: "Cave",
						last_name: "Johnson",
						antenna: "AEGEE-Dresden",
						antenna_id: "1",
						foreign_id: "1",
						application_status: "requesting",
						application: [
							{
								field_id: event3.application_fields[0]._id,
								value: "I am unmotivated"
							}, {
								field_id: event3.application_fields[1]._id,
								value: "L"
							}, {
								field_id: event3.application_fields[3]._id,
								value: "lactose, gluten"
							}
						]
					}, {
						first_name: "Vincent",
						last_name: "Vega",
						antenna: "AEGEE-Helsinki",
						antenna_id: "3",
						foreign_id: "2",
						application_status: "requesting",
						application: []
					}
				]

				event3.save(function(err) {
					if(err) {
						console.log(err);
						throw err;
					}

					if(callback) {
						return callback({
							event1: event1,
							event2: event2,
							event3: event3
						});
					}
				});
			});
		});
	});
}

exports.clear = function() {
	Event.collection.drop();
}