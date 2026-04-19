/**
 * API Routing Integration Tests
 * This suite tests the actual HTTP endpoints of the microservice to ensure 
 * the Express router and server middleware are correctly configured.
 */
const chai = require('chai');
const should = chai.should();
const { createUserPayload } = require('../../lib/util/userPayload');
const { request } = require('./test-helper');
const { startServer, stopServer } = require('../../lib/server');

describe('Accounts', () => {
    const name = 'Router';
    const surname = 'withantennacheck';
    const data = createUserPayload({ givenName: name, surname: surname });

    /**
    * API Routing Integration Tests
    * This suite tests the actual HTTP endpoints of the microservice to ensure 
    * the Express router and server middleware are correctly configured.
    */
    before(async () => await startServer());
    after(async () => await stopServer());

    describe('POST /account', function () {
        // High timeout to accommodate external G-Suite API latency
        this.timeout(15000);
        it('Should add an account', async function() {
            payload = structuredClone(data);
            // console.log(payload);

            const res = await request({
                uri: '/account',
                method: 'POST',
                headers: { 'test-title': 'create account' },
                body: payload,
            });
            
            // console.log(res);
            const body = res.body;
            // console.log(body.message);

            res.statusCode.should.equal(201);
            body.success.should.equal(true);
        });

        it('Should suspend an account', async function() {
            payload = structuredClone(data);

            const res = await request({
                uri: '/account/' + payload.userPK + '/suspend',
                method: 'PUT',
                headers: { 'test-title': 'suspend account' },
                body: payload,
            });

            res.statusCode.should.equal(200);
            res.body.success.should.equal(true);
        });

        it('Should activate an account', async function() {
            payload = structuredClone(data);

            const res = await request({
                uri: '/account/' + payload.userPK + '/activate',
                method: 'PUT',
                headers: { 'test-title': 'activate account' },
                body: payload,
            });

            res.statusCode.should.equal(200);
            res.body.success.should.equal(true);
        });
    });
});