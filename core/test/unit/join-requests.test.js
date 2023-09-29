const { startServer, stopServer } = require('../../lib/server');
const generator = require('../scripts/generator');
const { JoinRequest } = require('../../models');

describe('Join requests testing', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should normalize fields', async () => {
        const body = await generator.createBody();
        const user = await generator.createUser();

        const request = await JoinRequest.create({
            user_id: user.id,
            body_id: body.id,
            motivation: '\t\t\ttest   \t\t \t'
        });
        expect(request.motivation).toEqual('test');
    });

    test('should not normalize fields that are not there', async () => {
        const body = await generator.createBody();
        const user = await generator.createUser();

        const request = await JoinRequest.create({
            user_id: user.id,
            body_id: body.id,
            motivation: null
        });
        expect(request.motivation).toEqual(null);
    });
});
