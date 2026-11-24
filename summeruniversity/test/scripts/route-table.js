// Rows for the table-driven sweeps (authentication-required.test.js, path-parameters.test.js).
// See docs/testing/backend-openapi.md.
const path = require('path');

const { Event, Application, Season } = require('../../models');
const generator = require('./generator');
const mock = require('./mock-core-registry');
const user = require('../assets/oms-core-valid.json').data;
const fullPermissions = require('../assets/oms-core-permissions-full.json').data;

const NONEXISTENT_ID = 2147483647; // the largest INTEGER

// The override `o[key]` if given, else the fixture value.
const pick = (o, key, fallback) => (o[key] !== undefined ? o[key] : fallback);

const event = (f, o) => `/single/${pick(o, 'event_id', f.event.id)}`;
const application = (f, o) => `${event(f, o)}/applications/${pick(o, 'application_id', f.application.id)}`;
const season = (f, o) => `/seasons/${pick(o, 'year', f.season.year)}`;

const reload = (model, id) => model.findByPk(id);

module.exports = {
    NONEXISTENT_ID,

    // A fully published Summer University in second approval that takes applications (the
    // generator's default), one accepted and confirmed application to it (not the caller's)
    // and an inactive season.
    createFixtures: async () => {
        const ev = await generator.createEvent();
        const app = await generator.createApplication(ev, { user_id: 2, body_id: user.bodies[0].id, status: 'accepted', confirmed: true });
        const s = await generator.createSeason({ year: 2030 });
        return { event: ev, application: app, season: s };
    },

    // operationId -> concrete path built from the fixtures; `o` overrides one parameter.
    paths: {
        createEvent: () => '/',
        listOrganizedEvents: () => '/mine/organizing',
        listParticipatingEvents: () => '/mine/participating',
        listApprovableEvents: () => '/mine/approvable',
        listBodyApplications: (f, o = {}) => `/boardview/${pick(o, 'body_id', user.bodies[0].id)}`,
        listFutureApplications: (f, o = {}) => `/applications/future/${pick(o, 'user_id', user.id)}`,
        getApplicationStats: () => '/applications',
        exportApplicationStats: () => '/applications/export?season=2026',
        listRecentEvents: () => '/recents',
        createSeason: () => '/seasons',
        updateSeason: (f, o = {}) => season(f, o),
        activateSeason: (f, o = {}) => `${season(f, o)}/active`,
        getEvent: (f, o = {}) => event(f, o),
        updateEvent: (f, o = {}) => event(f, o),
        deleteEvent: (f, o = {}) => event(f, o),
        setEventStatus: (f, o = {}) => `${event(f, o)}/status`,
        uploadEventImage: (f, o = {}) => `${event(f, o)}/upload`,
        setEventPublished: (f, o = {}) => `${event(f, o)}/published`,
        setEventApplicationPeriod: (f, o = {}) => `${event(f, o)}/application_period`,
        setEventOpenCall: (f, o = {}) => `${event(f, o)}/open_call`,
        listEventApplications: (f, o = {}) => `${event(f, o)}/applications`,
        createApplication: (f, o = {}) => `${event(f, o)}/applications`,
        exportEventApplications: (f, o = {}) => `${event(f, o)}/applications/export`,
        getApplication: (f, o = {}) => application(f, o),
        updateApplication: (f, o = {}) => application(f, o),
        setApplicationAttended: (f, o = {}) => `${application(f, o)}/attended`,
        setApplicationCancelled: (f, o = {}) => `${application(f, o)}/cancelled`,
        setApplicationConfirmed: (f, o = {}) => `${application(f, o)}/confirmed`,
        setApplicationStatus: (f, o = {}) => `${application(f, o)}/status`,
        setApplicationComment: (f, o = {}) => `${application(f, o)}/comment`,
    },

    // operationId -> path parameters that a fetch middleware or lookup finds (404 sweep).
    // `event_id` also takes a Summer University's url, so it has no 400.
    lookups: {
        updateSeason: ['year'],
        activateSeason: ['year'],
        getEvent: ['event_id'],
        updateEvent: ['event_id'],
        deleteEvent: ['event_id'],
        setEventStatus: ['event_id'],
        uploadEventImage: ['event_id'],
        setEventPublished: ['event_id'],
        setEventApplicationPeriod: ['event_id'],
        setEventOpenCall: ['event_id'],
        listEventApplications: ['event_id'],
        createApplication: ['event_id'],
        exportEventApplications: ['event_id'],
        getApplication: ['event_id', 'application_id'],
        updateApplication: ['event_id', 'application_id'],
        setApplicationAttended: ['event_id', 'application_id'],
        setApplicationCancelled: ['event_id', 'application_id'],
        setApplicationConfirmed: ['event_id', 'application_id'],
        setApplicationStatus: ['event_id', 'application_id'],
        setApplicationComment: ['event_id', 'application_id'],
    },

    // path parameter -> the not-found message of the route's own lookup, for the value looked up.
    notFoundMessages: {
        event_id: (value) => `Event with id ${value} not found`,
        application_id: (value) => `Application with id ${value} not found`,
        year: () => 'Season is not found.',
    },

    // The message of the catch-all 404 for a path that no route matches.
    CATCH_ALL_MESSAGE: /^No such API endpoint: /,

    // operationId -> path parameters that answer 400 when they are not a number.
    badIds: {
        // Their 400 is about the request body (events-status.test.js, applications-creating.test.js,
        // body-object.test.js).
        setEventPublished: [],
        createApplication: [],
        updateSeason: [],
        updateEvent: [],
        setEventStatus: [],
        setEventApplicationPeriod: [],
        setEventOpenCall: [],
        listBodyApplications: ['body_id'],
        listFutureApplications: ['user_id'],
        getApplication: ['application_id'],
        updateApplication: ['application_id'],
        setApplicationAttended: ['application_id'],
        setApplicationCancelled: ['application_id'],
        setApplicationConfirmed: ['application_id'],
        setApplicationStatus: ['application_id'],
        setApplicationComment: ['application_id'],
    },

    // operationId -> a body that would succeed with a session (writes only). Every body changes
    // what `unchanged` checks, so that the sweep would see a write that went through.
    bodies: {
        createEvent: generator.generateEventBody(),
        createSeason: { year: 2031, name: 'Summer University 2031' },
        updateSeason: { name: 'Changed by the sweep' },
        updateEvent: { description: 'Changed by the sweep' },
        setEventStatus: { status: 'second submission' },
        setEventPublished: { published: 'none' },
        setEventApplicationPeriod: { application_ends: generator.daysFromNow(5) },
        setEventOpenCall: { open_call: true },
        createApplication: generator.generateApplicationBody(null, { body_id: user.bodies[0].id }),
        updateApplication: { motivation: 'Changed by the sweep' },
        setApplicationAttended: { attended: true },
        setApplicationCancelled: { cancelled: true },
        setApplicationConfirmed: { confirmed: false },
        setApplicationStatus: { status: 'rejected' },
        setApplicationComment: { board_comment: 'Changed by the sweep' },
    },

    // operationId -> the files of a multipart write that would succeed with a session.
    files: {
        uploadEventImage: { head_image: { path: path.join(__dirname, '..', 'assets', 'valid_image.png') } },
    },

    // operationId -> assertions that the write changed nothing (every write has one).
    unchanged: {
        createEvent: async () => expect(await Event.count()).toEqual(1),
        updateEvent: async (f) => expect((await reload(Event, f.event.id)).description).toEqual(f.event.description),
        deleteEvent: async (f) => expect((await reload(Event, f.event.id)).deleted).toEqual(false),
        setEventStatus: async (f) => expect((await reload(Event, f.event.id)).status).toEqual('second approval'),
        uploadEventImage: async (f) => expect((await reload(Event, f.event.id)).image).toEqual(null),
        setEventPublished: async (f) => expect((await reload(Event, f.event.id)).published).toEqual('full'),
        setEventApplicationPeriod: async (f) => expect((await reload(Event, f.event.id)).application_ends).toEqual(f.event.application_ends),
        setEventOpenCall: async (f) => expect((await reload(Event, f.event.id)).open_call).toEqual(false),
        createSeason: async () => expect(await Season.count({ where: { year: 2031 } })).toEqual(0),
        updateSeason: async (f) => expect((await reload(Season, f.season.id)).name).toEqual(f.season.name),
        activateSeason: async (f) => expect((await reload(Season, f.season.id)).active).toEqual(false),
        createApplication: async () => expect(await Application.count()).toEqual(1),
        updateApplication: async (f) => expect((await reload(Application, f.application.id)).motivation).toEqual(f.application.motivation),
        setApplicationAttended: async (f) => expect((await reload(Application, f.application.id)).attended).toEqual(false),
        setApplicationCancelled: async (f) => expect((await reload(Application, f.application.id)).cancelled).toEqual(false),
        setApplicationConfirmed: async (f) => expect((await reload(Application, f.application.id)).confirmed).toEqual(true),
        setApplicationStatus: async (f) => expect((await reload(Application, f.application.id)).status).toEqual('accepted'),
        setApplicationComment: async (f) => expect((await reload(Application, f.application.id)).board_comment).toEqual(null),
    },

    // Makes the next request unauthenticated: core answers 401 to all three auth calls.
    asAnonymous: () => mock.mockAll({
        core: { unauthorized: true },
        mainPermissions: { unauthorized: true },
        approvePermissions: { unauthorized: true }
    }),
    // Full permissions for the 404 sweep (every Summer University permission, a board of body 34).
    asFullPermissions: () => mock.mockAll({
        mainPermissions: { permissions: [...fullPermissions.map((p) => p.combined), 'global:manage_seasons:summeruniversity'] }
    }),
};
