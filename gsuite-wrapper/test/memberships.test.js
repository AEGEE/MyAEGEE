const crypto = require('crypto');
const chai = require('chai');

const should = chai.should();
const { request } = require('./test-helper');
const { runGsuiteOperation, gsuiteOperations } = require('../lib/google-suite');
const redis = require('../lib/redis').db;

function delay(interval) {
    return it('should delay', (done) => { setTimeout(() => done(), interval); },).timeout(interval + 100); // The extra 100ms should guarantee the test will not fail due to exceeded timeout
}

// TODO: Skipped until issues with existing entity for before hook and unknown groupKey with after hook is looked into
describe.skip('Memberships', () => {
    const primaryEmail = 'automated_test_group@aegee.eu';
    const groupName = 'The automated test group';
    const groupSubjectId = 'totallyuuid-group';

    const groupData = {
        primaryEmail,
        groupName,
        subjectID: groupSubjectId,
    };

    const name = 'Automated';
    const surname = 'APITest';
    const generatedUsername = name.toLowerCase() + '.' + surname.toLowerCase() + '@aegee.eu';
    const email = 'alternatemail817263@mailinator.com';
    const antenna = 'AEGEE-Tallahassee';
    const password = 'AEGEE-Europe';
    const SHA1Password = crypto.createHash('sha1').update(JSON.stringify(password)).digest('hex');
    const userSubjectId = 'totallyuuid-account';

    const accountData = {
        primaryEmail: generatedUsername,
        name: {
            givenName: name,
            familyName: surname,
        },
        password: SHA1Password,
        hashFunction: 'SHA-1',
        emails: [
            {
                address: email,
                type: 'home',
                customType: '',
                primary: true,
            },
        ],
        organizations: [
            {
                department: antenna,
            },
        ],
        orgUnitPath: '/individuals',
        includeInGlobalAddressList: true,
    };

    const data = {
        operation: 'add',
        groupPK: groupSubjectId,
    };

    before('add group and user', async function () {
        this.timeout(8000);
        let result = await runGsuiteOperation(gsuiteOperations.addGroup, groupData);
        console.log(result);
        result = await runGsuiteOperation(gsuiteOperations.addAccount, accountData);
        console.log(result);

        const groupPrimaryEmail = primaryEmail;
        const userPrimaryEmail = generatedUsername;
        const userSecondaryEmail = email;
        // group
        redis.hset('group:' + groupSubjectId, 'GsuiteAccount', groupPrimaryEmail);
        redis.set('primary:' + groupSubjectId, groupPrimaryEmail);
        redis.set('id:' + groupPrimaryEmail, groupSubjectId);
        // user
        redis.hset('user:' + userSubjectId, 'GsuiteAccount', userPrimaryEmail, 'SecondaryEmail', userSecondaryEmail);
        redis.set('primary:' + userSubjectId, userPrimaryEmail);
        redis.set('primary:' + userSecondaryEmail, userPrimaryEmail);
        redis.set('id:' + userPrimaryEmail, userSubjectId);
        redis.set('secondary:' + userPrimaryEmail, userSecondaryEmail);
    });

    after('Remove group and user', async function () {
        this.timeout(8000);

        let keys = await redis.keys('*');
        console.log(keys);

        let result = await runGsuiteOperation(gsuiteOperations.deleteGroup, groupData);
        console.log(result);
        result = await runGsuiteOperation(gsuiteOperations.deleteAccount, accountData);
        console.log(result);

        const groupPrimaryEmail = primaryEmail;
        const userPrimaryEmail = generatedUsername;
        const userSecondaryEmail = email;
        // group
        const pip = redis.pipeline();
        pip.hdel('group:' + groupSubjectId, 'GsuiteAccount');
        pip.del('primary:' + groupSubjectId, 'id:' + groupPrimaryEmail);
        // user
        pip.hdel('user:' + userSubjectId, 'GsuiteAccount');
        pip.hdel('user:' + userSubjectId, 'SecondaryEmail');
        pip.del('primary:' + userSubjectId, 'primary:' + userSecondaryEmail, 'id:' + userPrimaryEmail, 'secondary:' + userPrimaryEmail);
        pip.exec((err, res) => { console.log(err); console.log(res); });

        keys = await redis.keys('*');
        console.log(keys);
    });

    describe('PUT /account/:username/group', () => {
        delay(2000); // because they've just been created by the before

        it('Should make a membership if valid', async () => {
            const payload = JSON.parse(JSON.stringify(data));

            const res = await request({
                uri: '/account/' + userSubjectId + '/group',
                method: 'PUT',
                headers: { 'test-title': 'create membership' },
                body: payload,
            });

            const body = res.body;
            res.statusCode.should.equal(201);
            body.success.should.equal(true);
        });

        it('Should not make a membership if already present', async () => {
            const payload = JSON.parse(JSON.stringify(data));

            const res = await request({
                uri: '/account/' + userSubjectId + '/group',
                method: 'PUT',
                headers: { 'test-title': 'fail create membership' },
                body: payload,
            });

            const body = res.body;
            res.statusCode.should.equal(409);
            body.success.should.equal(false);
        });

        it.skip('Should not make a membership if no :username in url', async () => {
            // THIS should call the controller defined in server.js, which is commented out.
            // Test is skipped until i fix that
            const payload = JSON.parse(JSON.stringify(data));
            const emptySubjectId = '';

            const res = await request({
                uri: '/account/' + emptySubjectId + '/group',
                method: 'PUT',
                headers: { 'test-title': 'fail create membership' },
                body: payload,
            });

            const body = res.body;
            res.statusCode.should.equal(404); // OR 500?
            body.success.should.equal(false);
        });

        it('Should not make a membership if no operation in payload', async () => {
            const payload = JSON.parse(JSON.stringify(data));
            payload.operation = '';

            const res = await request({
                uri: '/account/' + userSubjectId + '/group',
                method: 'PUT',
                headers: { 'test-title': 'fail create membership' },
                body: payload,
            });

            const body = res.body;
            res.statusCode.should.equal(400);
            body.success.should.equal(false);
        });

        it('Should not make a membership if no operation in payload', async () => {
            const payload = JSON.parse(JSON.stringify(data));
            delete payload.operation;

            const res = await request({
                uri: '/account/' + userSubjectId + '/group',
                method: 'PUT',
                headers: { 'test-title': 'fail create membership' },
                body: payload,
            });

            const body = res.body;
            res.statusCode.should.equal(400);
            body.success.should.equal(false);
        });

        it('Should not make a membership if no groupPK in payload', async () => {
            const payload = JSON.parse(JSON.stringify(data));
            payload.groupPK = '';

            const res = await request({
                uri: '/account/' + userSubjectId + '/group',
                method: 'PUT',
                headers: { 'test-title': 'fail create membership' },
                body: payload,
            });

            const body = res.body;
            res.statusCode.should.equal(400);
            body.success.should.equal(false);
        });

        it('Should not make a membership if no groupPK in payload', async () => {
            const payload = JSON.parse(JSON.stringify(data));
            delete payload.groupPK;

            const res = await request({
                uri: '/account/' + userSubjectId + '/group',
                method: 'PUT',
                headers: { 'test-title': 'fail create membership' },
                body: payload,
            });

            const body = res.body;
            res.statusCode.should.equal(400);
            body.success.should.equal(false);
        });

        it('Should not add a membership if mistaken payload (swap user&group)', async () => {
            const payload = JSON.parse(JSON.stringify(data));
            payload.groupPK = userSubjectId;

            const res = await request({
                uri: '/account/' + groupSubjectId + '/group',
                method: 'PUT',
                headers: { 'test-title': 'fail make membership' },
                body: payload,
            });

            const body = res.body;
            res.statusCode.should.equal(404);
            body.success.should.equal(false);
        });

        it('Should not remove a membership if mistaken payload (swap user&group)', async () => {
            const payload = JSON.parse(JSON.stringify(data));
            payload.operation = 'remove';
            payload.groupPK = userSubjectId;

            const res = await request({
                uri: '/account/' + groupSubjectId + '/group',
                method: 'PUT',
                headers: { 'test-title': 'fail revoke membership' },
                body: payload,
            });

            const body = res.body;
            res.statusCode.should.equal(404);
            body.success.should.equal(false);
        });

        delay(1500);

        it('Should remove a membership if valid', async () => {
            const payload = JSON.parse(JSON.stringify(data));
            payload.operation = 'remove';

            const res = await request({
                uri: '/account/' + userSubjectId + '/group',
                method: 'PUT',
                headers: { 'test-title': 'revoke membership' },
                body: payload,
            });

            const body = res.body;
            res.statusCode.should.equal(200);
            body.success.should.equal(true);
        });

        it('Should not remove a membership if none', async () => {
            const payload = JSON.parse(JSON.stringify(data));
            payload.operation = 'remove';

            const res = await request({
                uri: '/account/' + userSubjectId + '/group',
                method: 'PUT',
                headers: { 'test-title': 'fail revoke membership' },
                body: payload,
            });

            const body = res.body;
            res.statusCode.should.equal(404);
            body.success.should.equal(false);
        });

        delay(2000); // for the final removal called in the "after"
    });

    delay(2000);
});
