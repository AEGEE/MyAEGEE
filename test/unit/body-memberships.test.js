const { startServer, stopServer } = require('../../lib/server');
const generator = require('../scripts/generator');
const { BodyMembership } = require('../../models');

describe('Body memberships testing', () => {
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

        const membership = await BodyMembership.create({
            user_id: user.id,
            body_id: body.id,
            comment: '\t\t\ttest   \t\t \t'
        });
        expect(membership.comment).toEqual('test');
    });

    test('should not normalize fields that are not there', async () => {
        const body = await generator.createBody();
        const user = await generator.createUser();

        const membership = await BodyMembership.create({
            user_id: user.id,
            body_id: body.id,
            comment: null
        });
        expect(membership.comment).toEqual(null);
    });
});
