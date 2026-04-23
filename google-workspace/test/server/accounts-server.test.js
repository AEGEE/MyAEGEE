/**
 * 
 * npx mocha test/server/accounts-server.test.js
 * npx mocha test/server/accounts-server.test.js --grep "Should add an account"
 * 
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
    const surname = 'GimmeGimme';
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
            // const payload = JSON.parse(JSON.stringify(data));
            // below should be the new version, faster and keeping extra details
            // structuredClone creates a deep copy of 'data' to prevent mutating the original object
            // need Node.js 17 or higher
            payload = structuredClone(data);
            // console.log(payload);

            const res = await request({
                uri: '/account',
                method: 'POST',
                headers: { 'test-title': 'create account' },
                body: payload,
            });
            
            // The res object is huge... this is why we select the body. 
            const body = res.body;
            // console.log(body);

            // Test that operation is successful 
            res.statusCode.should.equal(201);
            body.success.should.equal(true);
            // Test that the primaryEmail is created as intended. 
            body.data.primaryEmail.should.equal(data.primaryEmail);
        });

        it('Should suspend an account', async function() {
            payload = structuredClone(data);

            const res = await request({
                uri: '/account/' + payload.userPK + '/suspend',
                method: 'PUT',
                headers: { 'test-title': 'suspend account' },
                body: payload,
            });

            const body = res.body;
            // console.log(body);

            // Test that operation is successful
            res.statusCode.should.equal(200);
            body.success.should.equal(true);
            // Test that the flag suspended is changed. 
            body.data.suspended.should.equal(true);
        });

        it('Should activate an account', async function() {
            payload = structuredClone(data);

            const res = await request({
                uri: '/account/' + payload.userPK + '/activate',
                method: 'PUT',
                headers: { 'test-title': 'activate account' },
                body: payload,
            });

            const body = res.body;
            // console.log(body);


            // Test that operation is successful
            res.statusCode.should.equal(200);
            body.success.should.equal(true);
            // Test that the flag suspended is changed. 
            body.data.suspended.should.equal(false);
        });
    });
});