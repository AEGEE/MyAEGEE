const fs = require('fs');
const { rimraf } = require('rimraf');

const { startServer, stopServer } = require('../../lib/server');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { operations, createFixtures, requestFor } = require('../scripts/operations');
const config = require('../../config');
const {
    Event,
    Image,
    Application,
    MembersList,
    PaxLimit,
    VotesPerAntenna,
    VotesPerDelegate,
    Position,
    Candidate,
    Plenary,
    Attendance,
    QuestionLine,
    Question
} = require('../../models');

// Every operation of openapi.yaml, by what its `security` says. Statutory passes the token
// on to core without looking at it, so a missing token and a rejected one are the same
// case: core answers 401 on all four calls statutory makes with it.
const withAuth = (auth) => operations
    .filter((operation) => operation.auth === auth)
    .map((operation) => [`${operation.method} ${operation.template}`, operation]);

const rejectedToken = () => mock.mockAll({
    core: { unauthorized: true },
    mainPermissions: { unauthorized: true },
    approvePermissions: { unauthorized: true },
    memberslistPermissions: { unauthorized: true }
});

// What the service stores, to show that a refused request changed nothing.
const models = {
    Event,
    Image,
    Application,
    MembersList,
    PaxLimit,
    VotesPerAntenna,
    VotesPerDelegate,
    Position,
    Candidate,
    Plenary,
    Attendance,
    QuestionLine,
    Question
};

const snapshot = async () => {
    const stored = {
        files: fs.existsSync(config.images_dir) ? fs.readdirSync(config.images_dir).sort() : []
    };
    for (const [name, model] of Object.entries(models)) {
        stored[name] = await model.findAll({ order: [['id', 'ASC']], raw: true });
    }

    return stored;
};

describe('Authentication required', () => {
    let fixtures;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();
        fixtures = await createFixtures();
    });

    afterEach(async () => {
        mock.cleanAll();

        await generator.clearAll();
        await rimraf(config.images_dir);
    });

    test('leaves only the health check, the metrics and the public pages of an event open', () => {
        const open = (auth) => operations
            .filter((operation) => operation.auth === auth)
            .map((operation) => operation.operationId)
            .sort();

        expect(open('none')).toEqual(['getHealthcheck', 'getMetrics', 'getRequestMetrics']);
        expect(open('optional')).toEqual([
            'getApplicationFields',
            'getCandidateFields',
            'getEvent',
            'getIncomingApplicationFields',
            'listEvents'
        ]);
    });

    test.each(withAuth('required'))('%s answers 401 when core rejects the token and stores nothing', async (_, operation) => {
        const { mailerStub } = rejectedToken();
        const before = await snapshot();

        const res = await requestFor(operation, fixtures, { headers: { 'X-Auth-Token': 'rejected' } });

        expect(res.statusCode).toEqual(401);
        expect(res.body).toEqual({ success: false, message: 'Error fetching data: user is not authenticated.' });
        expect(mailerStub.isDone()).toEqual(false);
        expect(await snapshot()).toEqual(before);
    });

    test.each(withAuth('optional'))('%s answers 200 to an anonymous caller', async (_, operation) => {
        rejectedToken();

        const res = await requestFor(operation, fixtures, { headers: {} });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
    });
});
