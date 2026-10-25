const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const constants = require('../../lib/constants');

describe('Users list', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should fail without search permission and without body_id', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        const res = await request({
            path: '/members_search',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(403);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        expect(res.body).not.toHaveProperty('data');
    });

    test('should succeed when everything is okay', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'search', object: 'member' });
        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });

        const res = await request({
            path: '/members_search',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(user.id);
    });

    test('should respect limit and offset', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        const member = await generator.createUser();
        await generator.createUser();

        await generator.createPermission({ scope: 'global', action: 'search', object: 'member' });
        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });

        const res = await request({
            path: '/members_search?limit=1&offset=1', // second one should be returned
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(member.id);

        expect(res.body.meta.count).toEqual(3);
    });

    test('should respect sorting', async () => {
        const firstUser = await generator.createUser({
            first_name: 'aaa',
            mail_confirmed_at: new Date(),
            superadmin: true
        });
        const token = await generator.createAccessToken(firstUser);

        await generator.createPermission({ scope: 'global', action: 'search', object: 'member' });
        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });

        const secondUser = await generator.createUser({ first_name: 'bbb' });

        const res = await request({
            path: '/members_search?sort=first_name&direction=desc', // second one should be returned
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(2);
        expect(res.body.data[0].id).toEqual(secondUser.id);
        expect(res.body.data[1].id).toEqual(firstUser.id);
    });

    test('should find by first_name', async () => {
        const user = await generator.createUser({ superadmin: true, first_name: 'aaa', last_name: 'bbb', email: 'ccc@test.io' });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'search', object: 'member' });
        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });
        await generator.createUser({ superadmin: true, first_name: 'zzz', last_name: 'zzz', email: 'zzz@test.io' });

        const res = await request({
            path: '/members_search?query=aaa',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(user.id);
    });

    test('should find by last_name', async () => {
        const user = await generator.createUser({ superadmin: true, first_name: 'zzz', last_name: 'aaa', email: 'ccc@test.io' });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'search', object: 'member' });
        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });
        await generator.createUser({ superadmin: true, first_name: 'zzz', last_name: 'zzz', email: 'zzz@test.io' });

        const res = await request({
            path: '/members_search?query=aaa',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(user.id);
    });

    test('should find by email', async () => {
        const user = await generator.createUser({ superadmin: true, first_name: 'zzz', last_name: 'zzz', email: 'aaa@test.io' });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'search', object: 'member' });
        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });
        await generator.createUser({ superadmin: true, first_name: 'zzz', last_name: 'zzz', email: 'zzz@test.io' });

        const res = await request({
            path: '/members_search?query=aaa',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(user.id);
    });

    test('should return contact fields to view:member holders (with GSuite ID)', async () => {
        const user = await generator.createUser({ superadmin: true, gsuite_id: 'test@aegee.eu' });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'search', object: 'member' });
        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });

        const res = await request({
            path: '/members_search',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        const expectedOutput = {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            username: user.username,
            email: user.email,
            gsuite_id: user.gsuite_id
        };

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0]).toEqual(expectedOutput);
    });

    test('should return contact fields to view:member holders (without GSuite ID)', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'search', object: 'member' });
        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });

        const res = await request({
            path: '/members_search',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        const expectedOutput = {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            username: user.username,
            email: user.email,
            gsuite_id: user.gsuite_id
        };

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).not.toHaveProperty('errors');

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0]).toEqual(expectedOutput);
    });

    test('should filter by body_id', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'search', object: 'member' });
        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });

        const body = await generator.createBody();
        const memberInBody = await generator.createUser();
        await generator.createBodyMembership(body, memberInBody);

        const memberNotInBody = await generator.createUser();

        const res = await request({
            path: '/members_search?body_id=' + body.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');

        const returnedIds = res.body.data.map((u) => u.id);
        expect(returnedIds).toContain(memberInBody.id);
        expect(returnedIds).not.toContain(memberNotInBody.id);
        expect(returnedIds).not.toContain(user.id);
    });

    test('should filter by multiple body_ids', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'search', object: 'member' });
        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });

        const body1 = await generator.createBody();
        const body2 = await generator.createBody();
        const memberInBody1 = await generator.createUser();
        const memberInBody2 = await generator.createUser();
        await generator.createBodyMembership(body1, memberInBody1);
        await generator.createBodyMembership(body2, memberInBody2);

        const memberNotInAnyBody = await generator.createUser();

        const res = await request({
            path: '/members_search?body_id=' + body1.id + ',' + body2.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);

        const returnedIds = res.body.data.map((u) => u.id);
        expect(returnedIds).toContain(memberInBody1.id);
        expect(returnedIds).toContain(memberInBody2.id);
        expect(returnedIds).not.toContain(memberNotInAnyBody.id);
    });

    test('should not duplicate users in multiple bodies when filtering by body_id', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'search', object: 'member' });
        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });

        const body1 = await generator.createBody();
        const body2 = await generator.createBody();
        const memberInBothBodies = await generator.createUser();
        await generator.createBodyMembership(body1, memberInBothBodies);
        await generator.createBodyMembership(body2, memberInBothBodies);

        const res = await request({
            path: '/members_search?body_id=' + body1.id + ',' + body2.id,
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);

        const matchingUsers = res.body.data.filter((u) => u.id === memberInBothBodies.id);
        expect(matchingUsers.length).toEqual(1);
        expect(res.body.meta.count).toEqual(1);
    });

    test('should combine body_id filter with query search', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'search', object: 'member' });
        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });

        const body = await generator.createBody();
        const matchingMember = await generator.createUser({ first_name: 'TestSearchName' });
        const nonMatchingMember = await generator.createUser({ first_name: 'OtherName' });
        await generator.createBodyMembership(body, matchingMember);
        await generator.createBodyMembership(body, nonMatchingMember);

        const res = await request({
            path: '/members_search?body_id=' + body.id + '&query=TestSearchName',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);

        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(matchingMember.id);
    });

    test('should ignore invalid body_id values', async () => {
        const user = await generator.createUser({ superadmin: true });
        const token = await generator.createAccessToken(user);

        await generator.createPermission({ scope: 'global', action: 'search', object: 'member' });
        await generator.createPermission({ scope: 'global', action: 'view', object: 'member' });

        const res = await request({
            path: '/members_search?body_id=invalid,nonsense',
            method: 'GET',
            headers: { 'X-Auth-Token': token.value }
        });

        // With all invalid IDs filtered out, it should behave like no body_id filter (return all)
        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(res.body).toHaveProperty('data');
        expect(res.body.data.length).toEqual(1);
        expect(res.body.data[0].id).toEqual(user.id);
    });

    describe('without global:view:member', () => {
        // A global searcher (e.g. a board member) who can't view all members.
        const createSearcher = async (options = {}) => {
            const user = await generator.createUser(options);
            const circle = await generator.createCircle();
            const permission = await generator.createPermission({ scope: 'global', action: 'search', object: 'member' });
            await generator.createCirclePermission(circle, permission);
            await generator.createCircleMembership(circle, user);
            return { user, token: await generator.createAccessToken(user) };
        };

        test('should only return id and names', async () => {
            const { user, token } = await createSearcher({ first_name: 'Searcher' });

            const res = await request({
                path: '/members_search?query=Searcher',
                method: 'GET',
                headers: { 'X-Auth-Token': token.value }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toEqual([{ id: user.id, first_name: user.first_name, last_name: user.last_name }]);
        });

        test('should return nothing for queries shorter than the minimum', async () => {
            const { token } = await createSearcher({ first_name: 'Searcher' });

            for (const query of ['', 'S', ' S ']) {
                const res = await request({
                    path: '/members_search?query=' + encodeURIComponent(query),
                    method: 'GET',
                    headers: { 'X-Auth-Token': token.value }
                });

                expect(res.statusCode).toEqual(200);
                expect(res.body.data).toEqual([]);
            }
        });

        test('should cap the page size', async () => {
            const { token } = await createSearcher({ first_name: 'Capped' });
            for (let i = 0; i < constants.MEMBERS_SEARCH.MAX_LIMIT + 1; i++) {
                await generator.createUser({ first_name: 'Capped' });
            }

            for (const path of ['/members_search?query=Capped', '/members_search?query=Capped&limit=1000']) {
                const res = await request({
                    path,
                    method: 'GET',
                    headers: { 'X-Auth-Token': token.value }
                });

                expect(res.statusCode).toEqual(200);
                expect(res.body.data.length).toEqual(constants.MEMBERS_SEARCH.MAX_LIMIT);
                expect(res.body.meta).not.toHaveProperty('count');
            }
        });

        test('should not match on parts of the email', async () => {
            const { token } = await createSearcher({ first_name: 'Searcher' });
            await generator.createUser({ first_name: 'Target', last_name: 'Person', email: 'secret.address@test.io' });

            // Neither an email substring nor "last name + start of the email" should match.
            for (const query of ['secret', 'test.io', 'Person s', 'Person secret']) {
                const res = await request({
                    path: '/members_search?query=' + encodeURIComponent(query),
                    method: 'GET',
                    headers: { 'X-Auth-Token': token.value }
                });

                expect(res.statusCode).toEqual(200);
                expect(res.body.data).toEqual([]);
            }
        });

        test('should find a member by their exact email', async () => {
            const { token } = await createSearcher({ first_name: 'Searcher' });
            const target = await generator.createUser({ email: 'exact.address@test.io' });

            const res = await request({
                path: '/members_search?query=Exact.Address@test.io',
                method: 'GET',
                headers: { 'X-Auth-Token': token.value }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toEqual([{ id: target.id, first_name: target.first_name, last_name: target.last_name }]);
        });

        test('should treat LIKE wildcards literally', async () => {
            const { token } = await createSearcher({ first_name: 'Searcher' });
            await generator.createUser({ first_name: 'Someone' });

            for (const query of ['%%', '__', '%_', '\\%']) {
                const res = await request({
                    path: '/members_search?query=' + encodeURIComponent(query),
                    method: 'GET',
                    headers: { 'X-Auth-Token': token.value }
                });

                expect(res.statusCode).toEqual(200);
                expect(res.body.data).toEqual([]);
            }
        });

        test('should ignore sorting by fields that are not returned', async () => {
            const { user, token } = await createSearcher({ first_name: 'Sorted', email: 'zzz@test.io' });
            const other = await generator.createUser({ first_name: 'Sorted', email: 'aaa@test.io' });

            const res = await request({
                path: '/members_search?query=Sorted&sort=email',
                method: 'GET',
                headers: { 'X-Auth-Token': token.value }
            });

            // Sorted by id instead of email, so the searcher (created first) comes first.
            expect(res.statusCode).toEqual(200);
            expect(res.body.data.map((u) => u.id)).toEqual([user.id, other.id]);
        });
    });

    describe('scoped to bodies, without global:search:member', () => {
        test('should search members of a body the user is a member of', async () => {
            const body = await generator.createBody();
            const user = await generator.createUser();
            const colleague = await generator.createUser({ first_name: 'Colleague' });
            const outsider = await generator.createUser({ first_name: 'Colleague' });
            await generator.createBodyMembership(body, user);
            await generator.createBodyMembership(body, colleague);
            const token = await generator.createAccessToken(user);

            const res = await request({
                path: '/members_search?query=Colleague&body_id=' + body.id,
                method: 'GET',
                headers: { 'X-Auth-Token': token.value }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toEqual([{ id: colleague.id, first_name: colleague.first_name, last_name: colleague.last_name }]);
            expect(res.body.data.map((u) => u.id)).not.toContain(outsider.id);
        });

        test('should include other requested bodies when the user is a member of one of them', async () => {
            const ownBody = await generator.createBody();
            const coOrganizingBody = await generator.createBody();
            const user = await generator.createUser();
            const coOrganizer = await generator.createUser({ first_name: 'CoOrganizer' });
            await generator.createBodyMembership(ownBody, user);
            await generator.createBodyMembership(coOrganizingBody, coOrganizer);
            const token = await generator.createAccessToken(user);

            const res = await request({
                path: '/members_search?query=CoOrganizer&body_id=' + ownBody.id + ',' + coOrganizingBody.id,
                method: 'GET',
                headers: { 'X-Auth-Token': token.value }
            });

            expect(res.statusCode).toEqual(200);
            expect(res.body.data.map((u) => u.id)).toEqual([coOrganizer.id]);
        });

        test('should fail if the user is not a member of any requested body', async () => {
            const ownBody = await generator.createBody();
            const otherBody = await generator.createBody();
            const user = await generator.createUser();
            await generator.createBodyMembership(ownBody, user);
            const token = await generator.createAccessToken(user);

            const res = await request({
                path: '/members_search?query=anything&body_id=' + otherBody.id,
                method: 'GET',
                headers: { 'X-Auth-Token': token.value }
            });

            expect(res.statusCode).toEqual(403);
            expect(res.body.success).toEqual(false);
            expect(res.body).not.toHaveProperty('data');
        });

        test('should only return names when searching a body', async () => {
            const body = await generator.createBody();
            const user = await generator.createUser();
            const colleague = await generator.createUser({ first_name: 'Colleague', email: 'colleague@test.io' });
            await generator.createBodyMembership(body, user);
            await generator.createBodyMembership(body, colleague);
            const token = await generator.createAccessToken(user);

            for (const query of ['colleague@test.io', 'Colleague c', 'test.io']) {
                const res = await request({
                    path: '/members_search?query=' + encodeURIComponent(query) + '&body_id=' + body.id,
                    method: 'GET',
                    headers: { 'X-Auth-Token': token.value }
                });

                expect(res.statusCode).toEqual(200);
                const expected = query === 'colleague@test.io'
                    ? [{ id: colleague.id, first_name: colleague.first_name, last_name: colleague.last_name }]
                    : [];
                expect(res.body.data).toEqual(expected);
                expect(res.body.meta).not.toHaveProperty('count');
            }
        });

        test('should fail when searching too many bodies at once', async () => {
            const body = await generator.createBody();
            const user = await generator.createUser();
            await generator.createBodyMembership(body, user);
            const token = await generator.createAccessToken(user);

            const otherIds = Array.from({ length: constants.MEMBERS_SEARCH.MAX_BODIES }, (value, index) => body.id + index + 1);

            const res = await request({
                path: '/members_search?query=anything&body_id=' + [body.id, ...otherIds].join(','),
                method: 'GET',
                headers: { 'X-Auth-Token': token.value }
            });

            expect(res.statusCode).toEqual(400);
            expect(res.body.success).toEqual(false);
        });

        test('should fail if body_id is repeated', async () => {
            const body = await generator.createBody();
            const user = await generator.createUser();
            await generator.createBodyMembership(body, user);
            const token = await generator.createAccessToken(user);

            const res = await request({
                path: '/members_search?query=anything&body_id=' + body.id + '&body_id=' + body.id,
                method: 'GET',
                headers: { 'X-Auth-Token': token.value }
            });

            expect(res.statusCode).toEqual(400);
            expect(res.body.success).toEqual(false);
        });

        test('should fail if all body_id values are invalid', async () => {
            const body = await generator.createBody();
            const user = await generator.createUser();
            await generator.createBodyMembership(body, user);
            const token = await generator.createAccessToken(user);

            const res = await request({
                path: '/members_search?query=anything&body_id=invalid,nonsense',
                method: 'GET',
                headers: { 'X-Auth-Token': token.value }
            });

            expect(res.statusCode).toEqual(403);
            expect(res.body.success).toEqual(false);
        });
    });
});
