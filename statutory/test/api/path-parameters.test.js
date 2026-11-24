const { rimraf } = require('rimraf');

const { startServer, stopServer } = require('../../lib/server');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { request } = require('../scripts/helpers');
const {
    operations,
    createFixtures,
    requestFor,
    ALL_PERMISSIONS
} = require('../scripts/operations');
const config = require('../../config');

// Every operation with a path parameter, taken from openapi.yaml. The caller holds every
// permission and everything the path names exists, so only the swept value decides the answer.
const rows = (paramName, values, filter = () => true) => operations
    .filter((operation) => operation.pathParams.includes(paramName) && filter(operation))
    .flatMap((operation) => values.map((value) => [`${operation.method} ${operation.template}`, value, operation]));

// The largest Postgres integer: an id of the right form that no row has.
const UNKNOWN_ID = '2147483647';

// Values that are not an id: not a number, negative, not whole, or past the largest Postgres integer.
const MALFORMED_IDS = ['abc', '-1', '1.5', '2147483648'];

// Ids of the right form that no row has: zero, which no serial id takes, and the largest one.
const UNKNOWN_IDS = ['0', UNKNOWN_ID];

// The ids that a router looks up before its routes run, with the two answers each gives.
const lookedUp = {
    position_id: { invalid: 'The position ID is invalid.', notFound: 'Position is not found.' },
    candidate_id: { invalid: 'The candidate ID is invalid.', notFound: 'Candidate is not found.' },
    plenary_id: { invalid: 'The plenary ID is invalid.', notFound: 'Plenary is not found.' },
    question_line_id: { invalid: 'The question line ID is invalid.', notFound: 'Question line is not found.' },
    question_id: { invalid: 'The question ID is invalid.', notFound: 'Question is not found.' }
};

// body_id is checked by each route itself, each with its own message. getPaxLimit does
// not check it: it asks core for the body whatever the value is.
const invalidBodyId = {
    deletePaxLimit: 'Body ID should be a number.',
    listBoardviewApplications: 'Body ID should be a number.',
    setBoardviewApplications: 'The body ID is invalid.',
    getMemberslist: 'The body_id parameter is invalid.',
    uploadMemberslist: 'The body_id parameter is invalid.',
    setMemberslistFeePaid: 'The body_id parameter is invalid.',
    getVotesForBody: 'The body ID is malformed.'
};

// The routes that answer 404 for a body without a row of theirs; the others take any body.
const unknownBodyId = {
    deletePaxLimit: (value) => `There's no limit for body with the ID ${value}.`,
    getMemberslist: () => 'Members list is not found.',
    setMemberslistFeePaid: () => 'Members list is not found.'
};

describe('Path parameters', () => {
    let fixtures;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll({ mainPermissions: { permissions: ALL_PERMISSIONS } });
        fixtures = await createFixtures();
    });

    afterEach(async () => {
        mock.cleanAll();

        await generator.clearAll();
        await rimraf(config.images_dir);
    });

    test('covers every path parameter of the spec', () => {
        const swept = [
            'event_id',
            'event_type',
            'user_id',
            'application_id',
            'prefix',
            'body_id',
            ...Object.keys(lookedUp)
        ];
        // The candidate image route takes its last segment as a parameter and never reads it.
        const notChecked = ['image'];

        expect([...new Set(operations.flatMap((operation) => operation.pathParams))].sort())
            .toEqual([...swept, ...notChecked].sort());

        // Every operation with a body id is in the table above, or is known not to check it.
        expect(operations.filter((operation) => operation.pathParams.includes('body_id')).map((o) => o.operationId).sort())
            .toEqual([...Object.keys(invalidBodyId), 'getPaxLimit'].sort());
    });

    test.each(rows('event_id', [UNKNOWN_ID, 'no-such-event', 'a\u0000b', '%', '50%_']))('%s answers 404 for the event %j', async (_, value, operation) => {
        const res = await requestFor(operation, fixtures, { pathValues: { event_id: value } });

        expect(res.statusCode).toEqual(404);
        expect(res.body).toEqual({ success: false, message: 'Event with such url or ID is not found.' });
    });

    describe.each(Object.entries(lookedUp))('%s', (paramName, messages) => {
        test.each(rows(paramName, MALFORMED_IDS))('%s answers 400 for the value %s', async (_, value, operation) => {
            const res = await requestFor(operation, fixtures, { pathValues: { [paramName]: value } });

            expect(res.statusCode).toEqual(400);
            expect(res.body).toEqual({ success: false, message: messages.invalid });
        });

        test.each(rows(paramName, UNKNOWN_IDS))('%s answers 404 for the unknown id %s', async (_, value, operation) => {
            const res = await requestFor(operation, fixtures, { pathValues: { [paramName]: value } });

            expect(res.statusCode).toEqual(404);
            expect(res.body).toEqual({ success: false, message: messages.notFound });
        });
    });

    // application_id is an id when it is all digits, otherwise a statutory id, so no value is malformed.
    test.each(rows('application_id', [UNKNOWN_ID, '999-9999', 'a\u0000b']))('%s answers 404 for the application %j', async (_, value, operation) => {
        const res = await requestFor(operation, fixtures, { pathValues: { application_id: value } });

        expect(res.statusCode).toEqual(404);
        expect(res.body).toEqual({ success: false, message: 'This user haven\'t applied to this event yet.' });
    });

    test.each(rows('body_id', MALFORMED_IDS, (operation) => invalidBodyId[operation.operationId]))(
        '%s answers 400 for the body id %s',
        async (_, value, operation) => {
            const res = await requestFor(operation, fixtures, { pathValues: { body_id: value } });

            expect(res.statusCode).toEqual(400);
            expect(res.body).toEqual({ success: false, message: invalidBodyId[operation.operationId] });
        }
    );

    test.each(rows('body_id', UNKNOWN_IDS, (operation) => unknownBodyId[operation.operationId]))(
        '%s answers 404 for the unknown body %s',
        async (_, value, operation) => {
            const res = await requestFor(operation, fixtures, { pathValues: { body_id: value } });

            expect(res.statusCode).toEqual(404);
            expect(res.body).toEqual({ success: false, message: unknownBodyId[operation.operationId](value) });
        }
    );

    test.each(rows('event_type', ['conference']))('%s answers 400 for the event type %s', async (_, value, operation) => {
        const res = await requestFor(operation, fixtures, { pathValues: { event_type: value } });

        expect(res.statusCode).toEqual(400);
        expect(res.body).toEqual({ success: false, message: 'The event type should be one of these: agora, epm, spm.' });
    });

    test.each(rows('user_id', ['abc', '2147483648']))('%s answers 400 for the user id %s', async (_, value, operation) => {
        const res = await requestFor(operation, fixtures, { pathValues: { user_id: value } });

        expect(res.statusCode).toEqual(400);
        expect(res.body).toEqual({ success: false, message: 'User ID should be a number.' });
    });

    test.each(rows('prefix', ['everything']))('%s answers 400 for the prefix %s', async (_, value, operation) => {
        const res = await requestFor(operation, fixtures, { pathValues: { prefix: value } });

        expect(res.statusCode).toEqual(400);
        expect(res.body).toEqual({
            success: false,
            message: 'Prefix should be one of these: "all", "incoming", but received everything'
        });
    });

    // The sweeps above encode their values; a path can also come with an encoding that is broken.
    test.each(operations.filter((operation) => operation.pathParams.length > 0).map((operation) => [`${operation.method} ${operation.template}`, operation]))(
        '%s answers 400 for a path that cannot be decoded',
        async (_, operation) => {
            const [first] = operation.pathParams;
            const path = operation.template
                .replace(`{${first}}`, '%E0%A4%A')
                .replace(/\{(\w+)\}/g, (__, name) => encodeURIComponent(fixtures.pathValues[name]));

            const res = await request({ path, method: operation.method, headers: { 'X-Auth-Token': 'blablabla' } });

            expect(res.statusCode).toEqual(400);
            expect(res.body).toEqual({ success: false, message: 'The path could not be read.' });
        }
    );
});
