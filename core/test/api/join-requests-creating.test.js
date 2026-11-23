const { startServer, stopServer } = require('../../lib/server');
const { request: sendRequest } = require('../scripts/helpers');
const joinRequests = require('../../middlewares/join-requests');
const generator = require('../scripts/generator');
const mock = require('../scripts/mock');
const constants = require('../../lib/constants');
const { JoinRequest } = require('../../models');

// The mail to the board is sent after the answer. The tests look at the mail, so they wait for it.
const request = async (options) => {
    const res = await sendRequest(options);
    await joinRequests.waitForBoardMails();
    return res;
};

describe('Join request creating', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        await mock.mockAll();
    });

    afterEach(async () => {
        await generator.clearAll();
        await mock.cleanAll();
    });

    test('should succeed if everything is okay', async () => {
        const user = await generator.createUser({ username: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();

        const res = await request({
            path: '/bodies/' + body.id + '/join-requests',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { motivation: 'test' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.motivation).toEqual('test');
    });

    test('should fail if join request is presented already', async () => {
        const user = await generator.createUser({ username: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();

        await generator.createJoinRequest(body, user);

        const res = await request({
            path: '/bodies/' + body.id + '/join-requests',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { motivation: 'test' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body).not.toHaveProperty('data');
        expect(res.body).toHaveProperty('errors');
    });

    test('should keep the request if the mail to the board cannot be sent', async () => {
        mock.mockAll({ mailer: { netError: true } });

        const user = await generator.createUser({ username: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();

        const otherUser = await generator.createUser();
        const permission = await generator.createPermission({ scope: 'local', action: 'process', object: 'join_request' });
        const circle = await generator.createCircle({ body_id: body.id });
        await generator.createBodyMembership(body, otherUser);
        await generator.createCircleMembership(circle, otherUser);
        await generator.createCirclePermission(circle, permission);

        const res = await request({
            path: '/bodies/' + body.id + '/join-requests',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { motivation: 'test' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body.data.user_id).toEqual(user.id);
        expect(await JoinRequest.count({ where: { user_id: user.id, body_id: body.id } })).toEqual(1);
    });

    test('should send mail to body email if no permission', async () => {
        const user = await generator.createUser({ username: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();

        const requestMock = mock.mockAll({
            mailer: {
                body: (b) => b.to.length === 1 && b.to[0] === body.email.toLowerCase()
            }
        });

        const res = await request({
            path: '/bodies/' + body.id + '/join-requests',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { motivation: 'test' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(requestMock.mailer.isDone()).toEqual(true);
    });

    test('should send mail to body email if no circles', async () => {
        const user = await generator.createUser({ username: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();

        const requestMock = mock.mockAll({
            mailer: {
                body: (b) => b.to.length === 1 && b.to[0] === body.email.toLowerCase()
            }
        });

        const otherUser = await generator.createUser();
        await generator.createPermission({ scope: 'local', action: 'process', object: 'join_request' });
        await generator.createBodyMembership(body, otherUser);

        const res = await request({
            path: '/bodies/' + body.id + '/join-requests',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { motivation: 'test' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(requestMock.mailer.isDone()).toEqual(true);
    });

    test('should send mail to body email if no members', async () => {
        const user = await generator.createUser({ username: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();

        const requestMock = mock.mockAll({
            mailer: {
                body: (b) => b.to.length === 1 && b.to[0] === body.email.toLowerCase()
            }
        });

        const otherUser = await generator.createUser();
        const permission = await generator.createPermission({ scope: 'local', action: 'process', object: 'join_request' });
        const circle = await generator.createCircle({ body_id: body.id });
        await generator.createBodyMembership(body, otherUser);
        await generator.createCirclePermission(circle, permission);

        const res = await request({
            path: '/bodies/' + body.id + '/join-requests',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { motivation: 'test' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(requestMock.mailer.isDone()).toEqual(true);
    });

    test('should send mails if there are members', async () => {
        const user = await generator.createUser({ username: 'test', mail_confirmed_at: new Date() });
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();

        const otherUser = await generator.createUser();
        const permission = await generator.createPermission({ scope: 'local', action: 'process', object: 'join_request' });
        const circle = await generator.createCircle({ body_id: body.id });
        await generator.createBodyMembership(body, otherUser);
        await generator.createCircleMembership(circle, otherUser);
        await generator.createCirclePermission(circle, permission);

        const requestMock = mock.mockAll({
            mailer: {
                body: (b) => b.to.length === 2
                    && b.to.includes(body.email.toLowerCase())
                    && b.to.includes(otherUser.email.toLowerCase())
            }
        });

        const res = await request({
            path: '/bodies/' + body.id + '/join-requests',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { motivation: 'test' }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).not.toHaveProperty('errors');
        expect(res.body).toHaveProperty('data');

        expect(requestMock.mailer.isDone()).toEqual(true);
    });

    test('should fail for somebody who is a member of the body already', async () => {
        const mails = mock.captureMails();

        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        await generator.createBodyMembership(body, user);

        const res = await request({
            path: '/bodies/' + body.id + '/join-requests',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { motivation: 'test' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body.message).toEqual('You are already a member of this body.');
        expect(res.body).not.toHaveProperty('data');

        expect(await JoinRequest.count({ where: { body_id: body.id } })).toEqual(0);
        expect(mails.length).toEqual(0);
    });

    test('should fail for a deleted body', async () => {
        const mails = mock.captureMails();

        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody({ status: 'deleted' });

        const res = await request({
            path: '/bodies/' + body.id + '/join-requests',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { motivation: 'test' }
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body.message).toEqual('This body is deleted and does not take join requests.');
        expect(res.body).not.toHaveProperty('data');

        expect(await JoinRequest.count({ where: { body_id: body.id } })).toEqual(0);
        expect(mails.length).toEqual(0);
    });

    test('should work for a member of another body', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const body = await generator.createBody();
        const otherBody = await generator.createBody();
        await generator.createBodyMembership(otherBody, user);

        const res = await request({
            path: '/bodies/' + body.id + '/join-requests',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { motivation: 'test' }
        });

        expect(res.statusCode).toEqual(200);
        expect(await JoinRequest.count({ where: { body_id: body.id, user_id: user.id } })).toEqual(1);
    });

    describe('mail about the new request', () => {
        let mails;
        let token;
        let body;
        let permission;

        beforeEach(async () => {
            mails = mock.captureMails();

            const user = await generator.createUser({ first_name: 'Some', last_name: 'Applicant' });
            token = await generator.createAccessToken(user);

            body = await generator.createBody({ name: 'AEGEE-Somewhere', email: 'board@somewhere.example.com' });
            permission = await generator.createPermission({ scope: 'local', action: 'process', object: 'join_request' });
        });

        const apply = () => request({
            path: '/bodies/' + body.id + '/join-requests',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            body: { motivation: 'test' }
        });

        // Somebody who is in a circle of a body that has the permission.
        const createProcessor = async (ofBody, circles, options) => {
            const member = await generator.createUser(options);
            await generator.createBodyMembership(ofBody, member);
            for (const circle of circles) {
                await generator.createCircleMembership(circle, member);
            }

            return member;
        };

        const createCircleWithPermission = async (ofBody) => {
            const circle = await generator.createCircle({ body_id: ofBody.id });
            await generator.createCirclePermission(circle, permission);
            return circle;
        };

        test('should go to the body and to the members who process its join requests, on the address they read', async () => {
            const board = await createCircleWithPermission(body);
            const secretaries = await createCircleWithPermission(body);

            // In both circles, but mailed once.
            await createProcessor(body, [board, secretaries], { email: 'president@example.com' });
            await createProcessor(body, [secretaries], {
                email: 'secretary@example.com',
                gsuite_id: 'secretary@aegee.eu',
                primary_email: 'gsuite'
            });

            // A member of the body who does not process join requests.
            const others = await generator.createCircle({ body_id: body.id });
            await createProcessor(body, [others], { email: 'member@example.com' });

            // Somebody who processes the join requests of another body.
            const otherBody = await generator.createBody({ email: 'board@elsewhere.example.com' });
            await createProcessor(otherBody, [await createCircleWithPermission(otherBody)], { email: 'elsewhere@example.com' });

            const res = await apply();

            expect(res.statusCode).toEqual(200);
            expect(mails.length).toEqual(1);

            const [mail] = mails;
            expect(mail.to[0]).toEqual('board@somewhere.example.com');
            expect({ ...mail, to: [...mail.to].sort() }).toEqual({
                to: ['board@somewhere.example.com', 'president@example.com', 'secretary@aegee.eu'],
                subject: constants.MAIL_SUBJECTS.NEW_JOIN_REQUEST,
                template: 'member_joined.html',
                parameters: {
                    member_firstname: 'Some',
                    member_lastname: 'Applicant',
                    body_name: 'AEGEE-Somewhere',
                    body_id: body.id
                }
            });
        });

        test('should go to the body only if nobody processes its join requests', async () => {
            const res = await apply();

            expect(res.statusCode).toEqual(200);
            expect(mails).toEqual([{
                to: ['board@somewhere.example.com'],
                subject: constants.MAIL_SUBJECTS.NEW_JOIN_REQUEST,
                template: 'member_joined.html',
                parameters: {
                    member_firstname: 'Some',
                    member_lastname: 'Applicant',
                    body_name: 'AEGEE-Somewhere',
                    body_id: body.id
                }
            }]);
        });

        test('should not be sent for a second request to the same body', async () => {
            const first = await apply();
            expect(first.statusCode).toEqual(200);

            const res = await apply();

            expect(res.statusCode).toEqual(422);
            expect(res.body).toEqual({
                success: false,
                errors: { body_id: ['body_id must be unique'], user_id: ['user_id must be unique'] }
            });
            expect(mails.length).toEqual(1);
            expect(await JoinRequest.count({ where: { body_id: body.id } })).toEqual(1);
        });
    });
});
