const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');
const generator = require('../scripts/generator');
const { sequelize } = require('../../lib/sequelize');
const regularUser = require('../assets/core-valid.json').data;

// The lists that come in the order of creation have a fixed order for rows that were
// created in the same millisecond too: by ID.
describe('Order of rows that were created at the same moment', () => {
    let event;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();
        event = await generator.createEvent({ type: 'agora', applications: [] });
    });

    afterEach(async () => {
        await generator.clearAll();
        mock.cleanAll();
    });

    // Gives every row of the table the same creation time, and rewrites the first rows
    // last, so that the database has them in another order than their IDs.
    const sameMomentInAnotherOrder = async (table, rows) => {
        await sequelize.query(`UPDATE ${table} SET created_at = '2031-07-01T10:00:00.000Z'`);
        for (const row of rows.slice(0, -1)) {
            await sequelize.query(`UPDATE ${table} SET updated_at = now() WHERE id = :id`, { replacements: { id: row.id } });
        }
    };

    const get = async (path) => {
        const res = await request({
            path: '/events/' + event.id + path,
            method: 'GET',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).toEqual(200);
        return res.body.data;
    };

    const ids = (rows) => rows.map((row) => row.id);

    test('should list question lines and their questions by ID', async () => {
        const application = await generator.createApplication({ user_id: regularUser.id, confirmed: true }, event);
        const lines = [];
        for (let index = 0; index < 4; index++) {
            lines.push(await generator.createQuestionLine({}, event));
        }
        const questions = [];
        for (let index = 0; index < 4; index++) {
            questions.push(await generator.createQuestion({ application_id: application.id }, lines[0]));
        }
        await sameMomentInAnotherOrder('question_lines', lines);
        await sameMomentInAnotherOrder('questions', questions);

        const data = await get('/question-lines');

        expect(ids(data)).toEqual(ids(lines));
        expect(ids(data[0].questions)).toEqual(ids(questions));
    });

    test('should list plenaries by ID', async () => {
        const plenaries = [];
        for (let index = 0; index < 4; index++) {
            plenaries.push(await generator.createPlenary({}, event));
        }
        await sameMomentInAnotherOrder('plenaries', plenaries);

        expect(ids(await get('/plenaries'))).toEqual(ids(plenaries));
    });

    test.each(['', '/all', '/approved'])('should list positions and their candidates by ID on /positions%s', async (suffix) => {
        const positions = [];
        for (let index = 0; index < 4; index++) {
            positions.push(await generator.createPosition({}, event));
        }
        const candidates = [];
        for (let index = 0; index < 4; index++) {
            candidates.push(await generator.createCandidate({ user_id: index + 1, status: 'approved' }, positions[0]));
        }
        await sameMomentInAnotherOrder('positions', positions);
        await sameMomentInAnotherOrder('candidates', candidates);

        const data = await get('/positions' + suffix);

        expect(ids(data)).toEqual(ids(positions));
        if (suffix) {
            expect(ids(data[0].candidates)).toEqual(ids(candidates));
        }
    });
});
