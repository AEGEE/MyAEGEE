process.env.NODE_ENV = 'test';

const log = require('../../lib/config/logger.js');

const mongoose = require('../../lib/config/mongo');

const Event = require('../../lib/models/Event');
const Status = require('../../lib/models/Status');
const Lifecycle = require('../../lib/models/Lifecycle');
const EventType = require('../../lib/models/EventType');

const futureDate = (offset) => {
  const retval = new Date();
  retval.setDate(retval.getDate() + offset);
  return retval;
};

const eventTypeNames = [
  'non-statutory',
  'statutory',
  'su',
  'local',
];

// A helper to split one big array to a bunch of smaller.
const arraySplit = (array, chunksNum) => {
  const chunkSize = array.length / chunksNum;
  const newArray = [];

  for (let i = 0; i < array.length; i += chunkSize) {
    newArray.push(array.slice(i, i + chunkSize));
  }

  return newArray;
};

function populateStatuses(callback) {
  // Creating a bunch of statuses for each lifecycle.
  const statuses = eventTypeNames.map(() => ([{
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
  }]));

  const statusesMerged = statuses.reduce((a, b) => a.concat(b));

  Status.insertMany(statusesMerged, (err, statusesFromDb) => {
    if (err) {
      log.error('Cannot save statuses: ', err);
      throw err;
    }

    callback(statusesFromDb);
  });
}

function populateLifecycle(statuses, callback) {
  // Splitting statuses array to a bunch of arrays,
  // each array for one lifecycle.
  const splitStatuses = arraySplit(statuses, eventTypeNames.length);

  const data = eventTypeNames.map((name, index) => {
    const draftStatus = splitStatuses[index].find(s => s.name === 'Draft')._id;
    const requestingStatus = splitStatuses[index].find(s => s.name === 'Requesting')._id;
    const approvedStatus = splitStatuses[index].find(s => s.name === 'Approved')._id;

    return {
      eventType: name,
      status: splitStatuses[index].map(s => s._id),
      transitions: [{
        from: null,
        to: draftStatus,
        allowedFor: {
          users: ['1'],
          roles: [],
          bodies: [],
          special: [],
        },
      }, {
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
          users: [],
          roles: [],
          bodies: [],
          special: [],
        },
      }],
      initialStatus: draftStatus,
    };
  });

  Lifecycle.insertMany(data, (err, lifecyclesFromDb) => {
    if (err) {
      log.error('Cannot save lifecycles: ', err);
      throw err;
    }

    callback(lifecyclesFromDb);
  });
}

function populateEventTypes(lifecycles, callback) {
  const data = eventTypeNames.map((name) => {
    return {
      name,
      defaultLifecycle: lifecycles.find(l => l.eventType === name)._id,
    };
  });

  EventType.insertMany(data, (err, eventTypesFromDb) => {
    if (err) {
      log.error('Cannot save lifecycle: ', err);
      throw err;
    }

    callback(eventTypesFromDb);
  });
}

function populateEvents(statuses, lifecycles, callback) {
  const nonStatutoryLifecycle = lifecycles.find(l => l.eventType === 'non-statutory');
  const nonStatutoryStatuses = statuses.filter(s => nonStatutoryLifecycle.status.includes(s._id));

  const draftStatus = nonStatutoryStatuses.find(s => s.name === 'Draft')._id;
  const approvedStatus = nonStatutoryStatuses.find(s => s.name === 'Approved')._id;

  const statutoryLifecycle = lifecycles.find(l => l.eventType === 'statutory');
  const statutoryStatuses = statuses.filter(s => statutoryLifecycle.status.includes(s._id));

  const requestingStatus = statutoryStatuses.find(s => s.name === 'Requesting')._id;

  const events = [{
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
    lifecycle: nonStatutoryLifecycle,
    max_participants: 22,
    application_deadline: futureDate(13),
    application_status: 'closed',
    organizers: [{
      first_name: 'Cave',
      last_name: 'Johnson',
      foreign_id: '1',
      antenna_id: 'DRE',
    }],
  }, {
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
    application_status: 'closed',
    status: requestingStatus,
    lifecycle: statutoryLifecycle,
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
  }, {
    name: 'NWM-Manchester',
    starts: futureDate(24),
    ends: futureDate(25),
    description: 'A training event to boost your self-confidence and teamworking skills',
    organizing_locals: [{ foreign_id: 'AEGEE-Dresden' }],
    type: 'non-statutory',
    status: approvedStatus,
    lifecycle: nonStatutoryLifecycle,
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
  }];

  Event.insertMany(events, (err, eventsFromDb) => {
    eventsFromDb[2].applications = [{
      first_name: 'Cave',
      last_name: 'Johnson',
      antenna: 'AEGEE-Dresden',
      antenna_id: '1',
      foreign_id: '1',
      application_status: 'requesting',
      application: [
        {
          field_id: eventsFromDb[2].application_fields[0]._id,
          value: 'I am unmotivated',
        }, {
          field_id: eventsFromDb[2].application_fields[1]._id,
          value: 'L',
        }, {
          field_id: eventsFromDb[2].application_fields[3]._id,
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
    }];

    eventsFromDb[2].save((event3SaveErr) => {
      if (event3SaveErr) {
        log.error('Could not resave event 3', event3SaveErr);
        throw event3SaveErr;
      }

      if (callback) {
        return callback(eventsFromDb);
      }

      return null;
    });
  });
}

exports.populateEvents = (callback) => {
  populateStatuses((statuses) => {
    populateLifecycle(statuses, (lifecycles) => {
      populateEventTypes(lifecycles, (eventTypes) => {
        populateEvents(statuses, lifecycles, events => callback({
          statuses,
          lifecycles,
          eventTypes,
          events,
        }));
      });
    });
  });
};

exports.populateLifecycles = (callback) => {
  populateStatuses((statuses) => {
    populateLifecycle(statuses, (lifecycles) => {
      populateEventTypes(lifecycles, eventTypes => callback({
        statuses,
        lifecycles,
        eventTypes,
      }));
    });
  });
};

exports.clear = () => {
  mongoose.connection.dropDatabase();
};
