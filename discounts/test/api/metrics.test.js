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
                generator.generateDiscount({ name: 'Partner 1' }),
                generator.generateDiscount({ name: 'Partner 2' })
            ]
        });

        const integration = await generator.createIntegration({ name: 'Flixbus' });
        await generator.createCode({ claimed_by: null }, integration);
        await generator.createCode({ claimed_by: 1337 }, integration);

        const res = await request({
            path: '/metrics',
            method: 'GET',
            responseType: 'text'
        });

        expect(res.statusCode).toEqual(200);
        expect(res.headers['content-type']).toContain('text/plain');
        expect(res.body).toContain('discounts_categories_total 1');
        expect(res.body).toContain('discounts_integrations_total 1');
        expect(res.body).toContain('discounts_partners_total{category_name="Travel"} 2');
        expect(res.body).toMatch(/discounts_codes_total\{[^\n]*claimed="false"[^\n]*integration_name="Flixbus"[^\n]*\} 1/);
        expect(res.body).toMatch(/discounts_codes_total\{[^\n]*claimed="true"[^\n]*integration_name="Flixbus"[^\n]*\} 1/);
    });

    test('should return data correctly on /metrics/requests', async () => {
        await request({
            uri: '/healthcheck',
            method: 'GET',
            json: false
        });

        await request({
            uri: '/metrics',
            method: 'GET',
            json: false
        });

        const res = await request({
            path: '/metrics/requests',
            method: 'GET',
            responseType: 'text'
        });

        expect(res.statusCode).toEqual(200);
        expect(res.headers['content-type']).toContain('text/plain');
        expect(res.body).toMatch(/discounts_requests_total\{[^\n]*endpoint="\/healthcheck"[^\n]*status="200"[^\n]*path="\/healthcheck"[^\n]*method="GET"[^\n]*\} 1/);
        expect(res.body).toMatch(/discounts_requests_total\{[^\n]*endpoint="\/metrics"[^\n]*status="200"[^\n]*path="\/metrics"[^\n]*method="GET"[^\n]*\} [1-9]\d*/);
    });
});
