const chai = require('chai');

const { startServer, stopServer } = require('../../lib/server.js');
const { request } = require('../scripts/helpers');
const mock = require('../scripts/mock-core-registry');

const expect = chai.expect;

describe('API requests', () => {
    beforeEach(async () => {
        await startServer();
    });

    afterEach(async() => {
        await stopServer();
    });

    it('should fail if body is not JSON', async () => {
        const res = await request({
            uri: '/',
            method: 'POST',
            headers: {
                'X-Auth-Token': 'blablabla',
                'Content-Type': 'application/json'
            },
            body: 'Totally not JSON'
        });

        expect(res.statusCode).to.be.equal(400);
        expect(res.body).to.be.a('object');
        expect(res.body.success).to.be.false;

    });

    it('should fail on accessing non-existant endpoint', async () => {
        const res = await request({
            uri: '/nonexistant',
            headers: { 'X-Auth-Token': 'blablabla' }
        });

        expect(res.statusCode).to.be.equal(404);
        expect(res.body).to.be.a('object');
        expect(res.body.success).to.be.false;
    });
});
