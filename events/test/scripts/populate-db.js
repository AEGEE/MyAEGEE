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
      circles: [],
      bodies: [],
      special: ['Organizer'],
    };

    const publicAccess = {
      users: [],
      circles: [],
      bodies: [],
      special: ['Public'],
    };

    const firstUserAccess = {
      users: [firstUser.id],
      circles: [],
      bodies: [],
      special: [],
    };

    const secondUserAccess = {
      users: [secondUser.id],
      circles: [],
      bodies: [],
      special: [],
    };

    const emptyAccess = {
      users: [],
      circles: [],
      bodies: [],
      special: [],
    };

    const statuses = [{
      name: 'Draft',
      visibility: organizerAccess,
      applicable: organizerAccess,
      edit_details: organizerAccess,
      edit_organizers: organizerAccess,
      edit_application_status: organizerAccess,
      approve_participants: organizerAccess,
      view_applications: organizerAccess
    }, {
      name: 'Requesting',
      visibility: firstUserAccess,
      applicable: organizerAccess,
      edit_details: organizerAccess,
      edit_organizers: organizerAccess,
      edit_application_status: organizerAccess,
      approve_participants: organizerAccess,
      view_applications: organizerAccess
    }, {
      name: 'Approved',
      visibility: publicAccess,
      applicable: publicAccess,
      edit_details: organizerAccess,
      edit_organizers: organizerAccess,
      edit_application_status: organizerAccess,
      approve_participants: organizerAccess,
      view_applications: organizerAccess
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
        allowedFor: firstUserAccess,
      }, {
        from: draftStatus.name,
        to: requestingStatus.name,
        allowedFor: firstUserAccess,
      }, {
        from: requestingStatus.name,
        to: approvedStatus.name,
        allowedFor: firstUserAccess,
      }, {
        from: requestingStatus.name,
        to: draftStatus.name,
        allowedFor: emptyAccess,
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
        body_id: 1
      }],
      type: 'non-statutory',
      status: nonStatutoryEventType.defaultLifecycle.statuses.find(s => s.name === 'Draft'),
      lifecycle: nonStatutoryEventType.defaultLifecycle,
      max_participants: 22,
      application_deadline: futureDate(13),
      application_status: 'closed',
      organizers: [{
        user_id: firstUser.id
      }],
      applications: [{
        user_id: firstUser.id,
        body_id: 111,
        status: 'requesting',
        board_comment: 'Good guy, accept him plz!!'
      }, {
        user_id: 1337,
        body_id: 111,
        status: 'requesting',
        board_comment: 'Not sure about her'
      }, {
        user_id: 3112,
        body_id: 111,
        status: 'requesting',
        board_comment: 'Not suitable for event.'
      }]
    }, {
      name: 'EPM Zagreb',
      starts: futureDate(16),
      ends: futureDate(17),
      description: 'Drafting the Action Agenda and drinking cheap vodka',
      organizing_locals: [
        { body_id: 2 },
        { body_id: 3 },
      ],
      type: 'statutory',
      max_participants: 300,
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
          user_id: secondUser.id
        },
      ],
    }, {
      name: 'NWM-Manchester',
      starts: futureDate(24),
      ends: futureDate(25),
      description: 'A training event to boost your self-confidence and teamworking skills',
      organizing_locals: [{ body_id: 'AEGEE-Dresden' }],
      type: 'non-statutory',
      status: nonStatutoryEventType.defaultLifecycle.statuses.find(s => s.name === 'Approved'),
      lifecycle: nonStatutoryEventType.defaultLifecycle,
      max_participants: 22,
      application_deadline: futureDate(14),
      application_status: 'open',
      organizers: [{ user_id: 333 }],
      application_fields: [
        { name: 'Motivation' },
        { name: 'TShirt-Size' },
        { name: 'Meaning of Life' },
        { name: 'Allergies' },
      ],
    }, {
      name: 'SUPS Voronezh',
      starts: futureDate(24),
      ends: futureDate(25),
      description: 'Party like a Russian',
      organizing_locals: [{ body_id: 'AEGEE-Voronezh' }],
      type: 'non-statutory',
      status: nonStatutoryEventType.defaultLifecycle.statuses.find(s => s.name === 'Draft'),
      lifecycle: nonStatutoryEventType.defaultLifecycle,
      max_participants: 22,
      application_deadline: futureDate(14),
      application_status: 'open',
      organizers: [{ user_id: secondUser.id }],
      application_fields: [
        { name: 'Motivation' },
        { name: 'TShirt-Size' },
        { name: 'Meaning of Life' },
        { name: 'Allergies' },
      ],
    }, {
      name: 'LTC Ryazan',
      starts: futureDate(24),
      ends: futureDate(25),
      description: 'They have mushrooms with eyes!',
      organizing_locals: [{ body_id: 'AEGEE-Ryazan' }],
      type: 'non-statutory',
      status: nonStatutoryEventType.defaultLifecycle.statuses.find(s => s.name === 'Approved'),
      lifecycle: nonStatutoryEventType.defaultLifecycle,
      max_participants: 22,
      application_deadline: futureDate(14),
      application_status: 'open',
      organizers: [{ user_id: firstUser.id }],
      applications: [{
        user_id: secondUser.id,
        body_id: 111,
        status: 'requesting',
        board_comment: 'Good guy, accept him plz!!',
        application: [
          { field_id: 1, value: 'Lalala' },
          { field_id: 2, value: 'No value' }
        ]
      }],
      application_fields: [
        { id: 1, name: 'Motivation' },
        { id: 2, name: 'T-Shirt' }
      ],
    }, {
      name: 'LTC Samara',
      starts: futureDate(24),
      ends: futureDate(25),
      description: 'That is awesome!',
      organizing_locals: [{ body_id: 'AEGEE-Samara' }],
      type: 'non-statutory',
      status: nonStatutoryEventType.defaultLifecycle.statuses.find(s => s.name === 'Draft'),
      lifecycle: nonStatutoryEventType.defaultLifecycle,
      max_participants: 22,
      application_deadline: futureDate(14),
      application_status: 'open',
      organizers: [{ user_id: firstUser.id }],
      applications: [{
        user_id: secondUser.id,
        body_id: 1112,
        status: 'requesting',
        board_comment: 'Good guy, accept him plz!!2',
        application: [
          { field_id: 1, value: 'Lalala' },
          { field_id: 2, value: 'No value' }
        ]
      }],
      application_fields: [
        { id: 1, name: 'Motivation' },
        { id: 2, name: 'T-Shirt' }
      ],
    }, {
      name: 'RTC Rostov',
      starts: futureDate(24),
      ends: futureDate(25),
      description: 'That is awesome!',
      organizing_locals: [{ body_id: 'AEGEE-Rostov-na-Donu' }],
      type: 'non-statutory',
      status: nonStatutoryEventType.defaultLifecycle.statuses.find(s => s.name === 'Approved'),
      lifecycle: nonStatutoryEventType.defaultLifecycle,
      max_participants: 22,
      application_deadline: futureDate(14),
      application_status: 'closed',
      organizers: [{ user_id: secondUser.id }, { user_id: firstUser.id }],
      applications: [{
        user_id: secondUser.id,
        body_id: 111,
        status: 'requesting',
        board_comment: 'Not that good',
        application: [
          { field_id: 1, value: 'Lalala' },
          { field_id: 2, value: 'No value' }
        ]
      }],
      application_fields: [
        { id: 1, name: 'Motivation' },
        { id: 2, name: 'T-Shirt' }
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

exports.clear = async () => {
  await mongoose.connection.dropDatabase();
};
