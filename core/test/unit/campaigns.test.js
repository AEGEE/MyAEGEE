const { startServer, stopServer } = require('../../lib/server');
const generator = require('../scripts/generator');
const { Campaign } = require('../../models');

describe('Campaigns testing', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should fail with null name', async () => {
        try {
            await generator.createCampaign({ name: null });
            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].path).toEqual('name');
        }
    });

    test('should fail with not set name', async () => {
        try {
            const campaign = generator.generateCampaign();
            delete campaign.name;

            await Campaign.create(campaign);

            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].path).toEqual('name');
        }
    });

    test('should fail with null url', async () => {
        try {
            await generator.createCampaign({ url: null });
            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].path).toEqual('url');
        }
    });

    test('should fail with not set url', async () => {
        try {
            const campaign = generator.generateCampaign();
            delete campaign.url;

            await Campaign.create(campaign);

            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].path).toEqual('url');
        }
    });

    test('should fail with null description_long', async () => {
        try {
            await generator.createCampaign({ description_long: null });
            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].path).toEqual('description_long');
        }
    });

    test('should fail with not set description_long', async () => {
        try {
            const campaign = generator.generateCampaign();
            delete campaign.description_long;

            await Campaign.create(campaign);

            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].path).toEqual('description_long');
        }
    });

    test('should normalize fields', async () => {
        const data = generator.generateCampaign({
            name: '\t\t\ttest\t\t\t',
            url: '\t\t\tTEST\t\t\t',
            description_long: '  \t test\t  \t',
        });

        const campaign = await Campaign.create(data);
        expect(campaign.name).toEqual('test');
        expect(campaign.url).toEqual('test');
        expect(campaign.description_long).toEqual('test');
    });

    test.each([
        ['empty', ''],
        ['only spaces', '  \t ']
    ])('should fail with a description_short that is %s', async (name, value) => {
        await expect(generator.createCampaign({ description_short: value })).rejects.toMatchObject({
            name: 'SequelizeValidationError',
            errors: [expect.objectContaining({ path: 'description_short', message: 'Description should be set.' })]
        });
        expect(await Campaign.count()).toEqual(0);
    });

    test('should succeed without a description_short', async () => {
        const campaign = await generator.createCampaign({ description_short: null });

        expect(campaign.description_short).toEqual(null);
    });

    test('should fail with the url of another campaign in another case', async () => {
        await generator.createCampaign({ url: 'summer' });

        await expect(generator.createCampaign({ url: ' SUMMER ' })).rejects.toMatchObject({
            name: 'SequelizeUniqueConstraintError',
            errors: [expect.objectContaining({ path: 'url', type: 'unique violation' })]
        });
        expect(await Campaign.count()).toEqual(1);
    });
});
