// Rows for the table-driven sweeps (authentication-required.test.js, path-parameters.test.js).
// See docs/testing/backend-openapi.md.
const { Event, Application } = require('../../models');
const generator = require('./generator');
const mock = require('./mock-core-registry');
const user = require('../assets/oms-core-valid.json').data;

const NONEXISTENT_ID = 2147483647; // the largest INTEGER

// The override `o[key]` if given, else the fixture value.
const pick = (o, key, fallback) => (o[key] !== undefined ? o[key] : fallback);

const event = (f, o) => `/single/${pick(o, 'event_id', f.event.id)}`;
const application = (f, o) => `${event(f, o)}/applications/${pick(o, 'application_id', f.application.id)}`;

module.exports = {
    NONEXISTENT_ID,

    // A published event that takes applications, and one application to it (not the caller's).
    createFixtures: async () => {
        const ev = await generator.createEvent({
            status: 'published',
            application_starts: new Date(Date.now() - 24 * 60 * 60 * 1000),
            application_ends: new Date(Date.now() + 24 * 60 * 60 * 1000),
            starts: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
            ends: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            questions: []
        });
        const app = await generator.createApplication(ev, { user_id: 2, body_id: user.bodies[0].id, answers: [] });
        return { event: ev, application: app };
    },

    // operationId -> concrete path built from the fixtures; `o` overrides one parameter.
    paths: {
        createEvent: () => '/',
        listMyOrganizedEvents: () => '/mine/organizing',
        listMyAppliedEvents: () => '/mine/participating',
        listApprovableEvents: () => '/mine/approvable',
        listBodyApplications: (f, o = {}) => `/boardview/${pick(o, 'body_id', user.bodies[0].id)}`,
        listFutureApplicationsForUser: (f, o = {}) => `/applications/future/${pick(o, 'user_id', user.id)}`,
        listMostRecentEuropeanEvents: () => '/recents',
        getEvent: (f, o = {}) => event(f, o),
        updateEvent: (f, o = {}) => event(f, o),
        deleteEvent: (f, o = {}) => event(f, o),
        setEventStatus: (f, o = {}) => `${event(f, o)}/status`,
        uploadEventImage: (f, o = {}) => `${event(f, o)}/upload`,
        setEventEuropeanStatus: (f, o = {}) => `${event(f, o)}/status/european_event`,
        listEventApplications: (f, o = {}) => `${event(f, o)}/applications`,
        createApplication: (f, o = {}) => `${event(f, o)}/applications`,
        exportEventApplications: (f, o = {}) => `${event(f, o)}/applications/export`,
        getApplication: (f, o = {}) => application(f, o),
        updateApplication: (f, o = {}) => application(f, o),
        setApplicationAttended: (f, o = {}) => `${application(f, o)}/attended`,
        setApplicationConfirmed: (f, o = {}) => `${application(f, o)}/confirmed`,
        setApplicationStatus: (f, o = {}) => `${application(f, o)}/status`,
        setApplicationBoardComment: (f, o = {}) => `${application(f, o)}/comment`,
    },

    // operationId -> path parameters that a fetch middleware looks up (404 sweep).
    // `event_id` also takes an event's url, so only `application_id` and the plain ids
    // below have a 400 for a value that is not a number (`badIds`).
    lookups: {
        getEvent: ['event_id'],
        updateEvent: ['event_id'],
        deleteEvent: ['event_id'],
        setEventStatus: ['event_id'],
        uploadEventImage: ['event_id'],
        setEventEuropeanStatus: ['event_id'],
        listEventApplications: ['event_id'],
        createApplication: ['event_id'],
        exportEventApplications: ['event_id'],
        getApplication: ['event_id', 'application_id'],
        updateApplication: ['event_id', 'application_id'],
        setApplicationAttended: ['event_id', 'application_id'],
        setApplicationConfirmed: ['event_id', 'application_id'],
        setApplicationStatus: ['event_id', 'application_id'],
        setApplicationBoardComment: ['event_id', 'application_id'],
    },

    // operationId -> path parameters that answer 400 when they are not a number.
    badIds: {
        // Its 400 is about the body in the request body (applications-creating.test.js).
        createApplication: [],
        listBodyApplications: ['body_id'],
        listFutureApplicationsForUser: ['user_id'],
        getApplication: ['application_id'],
        updateApplication: ['application_id'],
        setApplicationAttended: ['application_id'],
        setApplicationConfirmed: ['application_id'],
        setApplicationStatus: ['application_id'],
        setApplicationBoardComment: ['application_id'],
    },

    // operationId -> a body that would succeed with a session (writes only).
    bodies: {
        createEvent: generator.generateEvent({ organizers: [{ user_id: user.id }], organizing_bodies: [{ body_id: user.bodies[0].id }] }),
        updateEvent: { description: 'Changed by the sweep' },
        setEventStatus: { status: 'submitted' },
        setEventEuropeanStatus: { is_european_event: false },
        createApplication: { body_id: user.bodies[0].id, answers: [], agreed_to_privacy_policy: true },
        updateApplication: { answers: [] },
        setApplicationAttended: { attended: false },
        setApplicationConfirmed: { confirmed: true },
        setApplicationStatus: { status: 'accepted' },
        setApplicationBoardComment: { board_comment: 'Changed by the sweep' },
    },

    // operationId -> assertions that the write changed nothing.
    unchanged: {
        createEvent: async () => expect(await Event.count()).toEqual(1),
        updateEvent: async (f) => expect((await Event.findByPk(f.event.id)).description).toEqual(f.event.description),
        deleteEvent: async (f) => expect((await Event.findByPk(f.event.id)).deleted).toEqual(false),
        setEventStatus: async (f) => expect((await Event.findByPk(f.event.id)).status).toEqual('published'),
        uploadEventImage: async (f) => expect((await Event.findByPk(f.event.id)).image).toEqual(f.event.image),
        setEventEuropeanStatus: async (f) => expect((await Event.findByPk(f.event.id)).is_european_event).toEqual(true),
        createApplication: async () => expect(await Application.count()).toEqual(1),
        setApplicationConfirmed: async (f) => expect((await Application.findByPk(f.application.id)).confirmed).toEqual(false),
        setApplicationStatus: async (f) => expect((await Application.findByPk(f.application.id)).status).toEqual('pending'),
        setApplicationBoardComment: async (f) => expect((await Application.findByPk(f.application.id)).board_comment).toEqual(null),
    },

    // Makes the next request unauthenticated: core answers 401 to all three auth calls.
    asAnonymous: () => mock.mockAll({
        core: { unauthorized: true },
        mainPermissions: { unauthorized: true },
        approvePermissions: { unauthorized: true }
    }),
    // Full permissions for the 404 sweep.
    asFullPermissions: () => mock.mockAll(),
};
