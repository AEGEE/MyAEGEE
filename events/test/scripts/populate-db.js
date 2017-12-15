const mongoose = require('../../lib/config/mongo');

const Event = require('../../lib/models/Event');
const EventType = require('../../lib/models/EventType');
const firstUser = require('../assets/oms-core-valid').data;
const secondUser = require('../assets/oms-core-valid-not-superadmin').data;

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

async function populateEventTypes() {
  const lifecycles = eventTypeNames.map((name) => {
    // Setting statuses

    const organizerAccess = {
      users: [],
      roles: [],
      bodies: [],
      special: ['Organizer'],
    };

    const publicAccess = {
      users: [],
      roles: [],
      bodies: [],
      special: ['Public'],
    };

    const statuses = [{
      name: 'Draft',
      visibility: organizerAccess,
      applicable: organizerAccess,
      edit_details: organizerAccess,
      edit_organizers: organizerAccess
    }, {
      name: 'Requesting',
      visibility: {
        users: [firstUser.id],
        roles: [],
        bodies: [],
        special: [],
      },
      applicable: organizerAccess,
      edit_details: organizerAccess,
      edit_organizers: organizerAccess
    }, {
      name: 'Approved',
      visibility: publicAccess,
      applicable: publicAccess,
      edit_details: organizerAccess,
      edit_organizers: organizerAccess
    }];

    // Setting statuses for transitions
    const draftStatus = statuses[0];
    const requestingStatus = statuses[1];
    const approvedStatus = statuses[2];

    return {
      eventType: name,
      statuses,
      transitions: [{
        from: null,
        to: draftStatus.name,
        allowedFor: {
          users: [1],
          roles: [],
          bodies: [],
          special: [],
        },
      }, {
        from: draftStatus.name,
        to: requestingStatus.name,
        allowedFor: {
          users: [1],
          roles: [],
          bodies: [],
          special: [],
        },
      }, {
        from: requestingStatus.name,
        to: approvedStatus.name,
        allowedFor: {
          users: [1],
          roles: [],
          bodies: [],
          special: [],
        },
      }, {
        from: requestingStatus.name,
        to: draftStatus.name,
        allowedFor: {
          users: [],
          roles: [],
          bodies: [],
          special: [],
        },
      }],
      initialStatus: draftStatus.name,
    };
  });

  const eventTypes = lifecycles.map(lifecycle => ({
    name: lifecycle.eventType,
    defaultLifecycle: lifecycle
  }));

  try {
    const eventTypesFromDb = await EventType.insertMany(eventTypes);
    return eventTypesFromDb;
  } catch (err) {
    console.log('Error while saving event types:', err);
    throw err;
  }  
}

async function populateEvents(eventTypes) {
  const nonStatutoryEventType = eventTypes.find(l => l.name === 'non-statutory');
  const statutoryEventType = eventTypes.find(l => l.name === 'statutory');

  try {
    const events = [{
      name: 'Develop Yourself 4',
      starts: futureDate(14),
      ends: futureDate(15),
      description: 'A training event to boost your self-confidence and teamworking skills',
      organizing_locals: [{
        foreign_id: 1,
        name: 'AEGEE-Dresden',
      }],
      type: 'non-statutory',
      status: nonStatutoryEventType.defaultLifecycle.statuses.find(s => s.name === 'Draft'),
      lifecycle: nonStatutoryEventType.defaultLifecycle,
      max_participants: 22,
      application_deadline: futureDate(13),
      application_status: 'closed',
      organizers: [{
        first_name: firstUser.first_name,
        last_name: firstUser.last_name,
        foreign_id: firstUser.id,
        antenna_id: 'DRE',
      }],
    }, {
      name: 'EPM Zagreb',
      starts: futureDate(16),
      ends: futureDate(17),
      description: 'Drafting the Action Agenda and drinking cheap vodka',
      organizing_locals: [
        { foreign_id: 2, name: 'AEGEE-Zagreb' },
        { foreign_id: 3, name: 'AEGEE-Somethingelse' },
      ],
      type: 'statutory',
      max_participants: 300,
      application_deadline: futureDate(14),
      application_status: 'closed',
      status: statutoryEventType.defaultLifecycle.statuses.find(s => s.name === 'Requesting'),
      lifecycle: statutoryEventType.defaultLifecycle,
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
          first_name: secondUser.first_name,
          last_name: secondUser.last_name,
          foreign_id: secondUser.id,
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
      status: nonStatutoryEventType.defaultLifecycle.statuses.find(s => s.name === 'Approved'),
      lifecycle: nonStatutoryEventType.defaultLifecycle,
      max_participants: 22,
      application_deadline: futureDate(14),
      application_status: 'open',
      organizers: [{ foreign_id: 333, antenna_id: 'CAV' }],
      application_fields: [
        { name: 'Motivation' },
        { name: 'TShirt-Size' },
        { name: 'Meaning of Life' },
        { name: 'Allergies' },
      ],
    }];

    const eventsInDB = await Event.insertMany(events);
    return eventsInDB;
  } catch (err) {
    console.log('Error while saving events:', err);
    throw new Error(err);
  }
}

exports.populateEvents = async () => {
  const eventTypes = await populateEventTypes();
  const events = await populateEvents(eventTypes);
  return {
    eventTypes,
    events
  };
};

exports.populateLifecycles = async () => {
  const eventTypes = await populateEventTypes();
  return { eventTypes };
};

exports.clear = () => {
  mongoose.connection.dropDatabase();
};
