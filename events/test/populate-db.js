process.env.NODE_ENV = 'test';

const mongoose = require('../lib/config/mongo.js');
const log = require('../lib/config/logger.js');

const Event = require('../lib/models/Event');
const Status = require('../lib/models/Status');
const Lifecycle = require('../lib/models/Lifecycle');
const EventType = require('../lib/models/EventType');

const futureDate = (offset) => {
  const retval = new Date();
  retval.setDate(retval.getDate() + offset);
  return retval;
};

function populateStatuses(callback) {
  const statuses = [{
    name: 'Draft',
    visibility: {
      users: [],
      roles: [],
      bodies: [],
      special: [],
    },
    applicable: {
      users: [],
      roles: [],
      bodies: [],
      special: [],
    },
  }, {
    name: 'Requesting',
    visibility: {
      users: ['1'],
      roles: [],
      bodies: [],
      special: [],
    },
    applicable: {
      users: [],
      roles: [],
      bodies: [],
      special: [],
    },
  }, {
    name: 'Approved',
    visibility: {
      users: [],
      roles: [],
      bodies: [],
      special: ['Public'],
    },
    applicable: {
      users: [],
      roles: [],
      bodies: [],
      special: [],
    },
  }];

  Status.insertMany(statuses, (err, statusesFromDb) => {
    if (err) {
      log.error('Cannot save statuses: ', err);
      throw err;
    }

    callback(statusesFromDb);
  });
}

function populateLifecycle(statuses, callback) {
  const draftStatus = statuses.find(s => s.name === 'Draft')._id;
  const requestingStatus = statuses.find(s => s.name === 'Requesting')._id;
  const approvedStatus = statuses.find(s => s.name === 'Approved')._id;

  const data = {
    name: 'non-statutory',
    status: statuses.map(s => s._id),
    transitions: [{
      from: draftStatus,
      to: requestingStatus,
      allowedFor: {
        users: ['1'],
        roles: [],
        bodies: [],
        special: [],
      },
    }, {
      from: requestingStatus,
      to: approvedStatus,
      allowedFor: {
        users: ['1'],
        roles: [],
        bodies: [],
        special: [],
      },
    }, {
      from: requestingStatus,
      to: draftStatus,
      allowedFor: {
        users: ['1'],
        roles: [],
        bodies: [],
        special: [],
      },
    }],
    initialStatus: draftStatus,
  };

  const newLifecycle = new Lifecycle(data);
  newLifecycle.save((err, lifecycleFromDb) => {
    if (err) {
      log.error('Cannot save lifecycle: ', err);
      throw err;
    }

    callback(lifecycleFromDb);
  });
}

function populateEventType(lifecycle, callback) {
  const eventType = new EventType({
    name: 'non-statutory',
    defaultLifecycle: lifecycle._id,
  });

  eventType.save((err, eventTypeFromDb) => {
    if (err) {
      log.error('Cannot save lifecycle: ', err);
      throw err;
    }

    callback(eventTypeFromDb);
  });
}

function populateEvents(statuses, lifecycle, callback) {
  const draftStatus = statuses.find(s => s.name === 'Draft')._id;
  const requestingStatus = statuses.find(s => s.name === 'Requesting')._id;
  const approvedStatus = statuses.find(s => s.name === 'Approved')._id;

  const now = new Date();
  const event1 = new Event({
    name: 'Develop Yourself 4',
    starts: futureDate(14),
    ends: futureDate(15),
    description: 'A training event to boost your self-confidence and teamworking skills',
    organizing_locals: [{
      foreign_id: '1',
      name: 'AEGEE-Dresden',
    }],
    type: 'non-statutory',
    status: draftStatus,
    lifecycle,
    max_participants: 22,
    application_deadline: futureDate(13),
    application_status: 'closed',
    organizers: [{
      first_name: 'Cave',
      last_name: 'Johnson',
      foreign_id: '1',
      antenna_id: 'DRE',
    }],
  });

  event1.save((err, event) => {
    if (err) {
      log.error('could not save event 1', err, event1);
      throw err;
    }

    var event2 = new Event({
      name: 'EPM Zagreb',
      starts: futureDate(16),
      ends: futureDate(17),
      description: 'Drafting the Action Agenda and drinking cheap vodka',
      organizing_locals: [
        { foreign_id: '2', name: 'AEGEE-Zagreb' },
        { foreign_id: '3', name: 'AEGEE-Somethingelse' },
      ],
      type: 'statutory',
      max_participants: 300,
      application_deadline: futureDate(14),
      application_status: 'open',
      status: requestingStatus,
      lifecycle,
      application_fields: [
        { name: 'Motivation' },
        { name: 'Allergies' },
        { name: 'Disabilities' },
        { name: 'TShirt-Size' },
        { name: 'Meaning of Life' },
      ],
      organizers:
      [
        {
          first_name: 'Vincent',
          last_name: 'Vega',
          foreign_id: '2',
          antenna_id: 'ANT',
        },
      ],
    });

    event2.save((err, event2) => {
      if (err) {
        log.error('Could not save event 2', err);
        throw err;
      }

      var event3 = new Event({
        name: 'NWM-Manchester',
        starts: futureDate(24),
        ends: futureDate(25),
        description: 'A training event to boost your self-confidence and teamworking skills',
        organizing_locals: [{ foreign_id: 'AEGEE-Dresden' }],
        type: 'non-statutory',
        status: approvedStatus,
        lifecycle,
        max_participants: 22,
        application_deadline: futureDate(14),
        application_status: 'open',
        organizers: [{ foreign_id: 'cave.johnson', antenna_id: 'CAV' }],
        application_fields: [
          { name: 'Motivation' },
          { name: 'TShirt-Size' },
          { name: 'Meaning of Life' },
          { name: 'Allergies' },
        ],
      });

      event3.save((err, event3) => {
        if (err) {
          log.error('Could not save event 3', err);
          throw err;
        }

        event3.applications = [
          {
            first_name: 'Cave',
            last_name: 'Johnson',
            antenna: 'AEGEE-Dresden',
            antenna_id: '1',
            foreign_id: '1',
            application_status: 'requesting',
            application: [
              {
                field_id: event3.application_fields[0]._id,
                value: 'I am unmotivated',
              }, {
                field_id: event3.application_fields[1]._id,
                value: 'L',
              }, {
                field_id: event3.application_fields[3]._id,
                value: 'lactose, gluten',
              },
            ],
          }, {
            first_name: 'Vincent',
            last_name: 'Vega',
            antenna: 'AEGEE-Helsinki',
            antenna_id: '3',
            foreign_id: '2',
            application_status: 'requesting',
            application: [],
          },
        ];

        event3.save((err) => {
          if (err) {
            log.error('Could not resave event 3', err);
            throw err;
          }

          if (callback) {
            return callback({
              event1,
              event2,
              event3,
            });
          }
        });
      });
    });
  });
}

exports.populateEvents = (callback) => {
  populateStatuses((statuses) => {
    populateLifecycle(statuses, (lifecycle) => {
      populateEventType(lifecycle, () => {
        populateEvents(statuses, lifecycle, events => callback(events));
      });
    });
  });
};

exports.populateLifecycles = (callback) => {
  populateStatuses((statuses) => {
    populateLifecycle(statuses, (lifecycle) => {
      populateEventType(lifecycle, eventType => callback({
        statuses,
        lifecycle,
        eventType,
      }));
    });
  });
};

exports.clear = () => {
  Event.collection.drop();
};
