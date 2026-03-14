const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const mock = require('../scripts/mock');

describe('Metrics requests', () => {
    beforeEach(async () => {
        mock.mockAll();
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        mock.cleanAll();

        await generator.clearAll();
    });

    test('should return data correctly on /metrics', async () => {
        await generator.createCategory({
            name: 'Travel',
            discounts: [
                generator.generateDiscount({ name: 'Rail pass' }),
                generator.generateDiscount({ name: 'Bus pass' })
            ]
        });

        const integration = await generator.createIntegration({ name: 'FlixBus' });
        await generator.createCode({ claimed_by: null }, integration);
        await generator.createCode({ claimed_by: 1337 }, integration);

        const res = await request({
            uri: '/metrics',
            method: 'GET',
            json: false
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toContain('discounts_categories_total 1');
        expect(res.body).toContain('discounts_integrations_total 1');
        expect(res.body).toContain('discounts_partners_total{category_name="Travel"} 2');
        expect(res.body).toMatch(/discounts_codes_total\{[^}]*claimed="false"[^}]*integration_name="FlixBus"[^}]*\} 1/);
        expect(res.body).toMatch(/discounts_codes_total\{[^}]*claimed="true"[^}]*integration_name="FlixBus"[^}]*\} 1/);
    });

    test('should return data correctly on /metrics/requests', async () => {
        await request({
            uri: '/metrics',
            method: 'GET',
            json: false
        });

        await request({
            uri: '/metrics/requests',
            method: 'GET',
            json: false
        });

        const res = await request({
            uri: '/metrics/requests',
            method: 'GET',
            json: false
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toContain('discounts_requests_total');
        expect(res.body).toContain('endpoint="/metrics"');
        expect(res.body).toContain('path="/metrics"');
        expect(res.body).toContain('method="GET"');
        expect(res.body).toContain('endpoint="/metrics/requests"');
        expect(res.body).toContain('path="/metrics/requests"');
    });
});
