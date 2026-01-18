const { startServer, stopServer } = require('../../lib/server');
const generator = require('../scripts/generator');

describe('Unique indexes', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    describe('Users', () => {
        describe('Email', () => {
            test('should be unique', async () => {
                await generator.createUser({ email: 'test@test.io' });
                try {
                    await generator.createUser({ email: 'test@test.io' });
                    expect(1).toEqual(0);
                } catch (err) {
                    expect(err).toHaveProperty('errors');
                    expect(err.errors.length).toEqual(1);
                    expect(err.errors[0].type).toEqual('unique violation');
                    expect(err.errors[0].path).toEqual('email');
                }
            });

            test('should be unique case-insensitive', async () => {
                await generator.createUser({ email: 'test@test.io' });
                try {
                    await generator.createUser({ email: 'TEST@test.io' });
                    expect(1).toEqual(0);
                } catch (err) {
                    expect(err).toHaveProperty('errors');
                    expect(err.errors.length).toEqual(1);
                    expect(err.errors[0].type).toEqual('unique violation');
                    expect(err.errors[0].path).toEqual('email');
                }
            });

            test('should be unique with spaces/tabs', async () => {
                await generator.createUser({ email: '\t test@test.io\t' });
                try {
                    await generator.createUser({ email: 'test@test.io' });
                    expect(1).toEqual(0);
                } catch (err) {
                    expect(err).toHaveProperty('errors');
                    expect(err.errors.length).toEqual(1);
                    expect(err.errors[0].type).toEqual('unique violation');
                    expect(err.errors[0].path).toEqual('email');
                }
            });
        });

        describe('Username', () => {
            test('should be unique', async () => {
                await generator.createUser({ username: 'test' });
                try {
                    await generator.createUser({ username: 'test' });
                    expect(1).toEqual(0);
                } catch (err) {
                    expect(err).toHaveProperty('errors');
                    expect(err.errors.length).toEqual(1);
                    expect(err.errors[0].type).toEqual('unique violation');
                    expect(err.errors[0].path).toEqual('username');
                }
            });

            test('should be unique case-insensitive', async () => {
                await generator.createUser({ username: 'test' });
                try {
                    await generator.createUser({ username: 'TEST' });
                    expect(1).toEqual(0);
                } catch (err) {
                    expect(err).toHaveProperty('errors');
                    expect(err.errors.length).toEqual(1);
                    expect(err.errors[0].type).toEqual('unique violation');
                    expect(err.errors[0].path).toEqual('username');
                }
            });

            test('should be unique with spaces/tabs', async () => {
                await generator.createUser({ username: '\t test\t' });
                try {
                    await generator.createUser({ username: 'test' });
                    expect(1).toEqual(0);
                } catch (err) {
                    expect(err).toHaveProperty('errors');
                    expect(err.errors.length).toEqual(1);
                    expect(err.errors[0].type).toEqual('unique violation');
                    expect(err.errors[0].path).toEqual('username');
                }
            });
        });
    });

    describe('Bodies', () => {
        describe('Body code', () => {
            test('should be unique', async () => {
                await generator.createBody({ code: 'tet' });
                try {
                    await generator.createBody({ code: 'tet' });
                    expect(1).toEqual(0);
                } catch (err) {
                    expect(err).toHaveProperty('errors');
                    expect(err.errors.length).toEqual(1);
                    expect(err.errors[0].type).toEqual('unique violation');
                    expect(err.errors[0].path).toEqual('code');
                }
            });

            test('should be unique case-insensitive', async () => {
                await generator.createBody({ code: 'tst' });
                try {
                    await generator.createBody({ code: 'TST' });
                    expect(1).toEqual(0);
                } catch (err) {
                    expect(err).toHaveProperty('errors');
                    expect(err.errors.length).toEqual(1);
                    expect(err.errors[0].type).toEqual('unique violation');
                    expect(err.errors[0].path).toEqual('code');
                }
            });

            test('should be unique with spaces/tabs', async () => {
                await generator.createBody({ code: '\t est\t' });
                try {
                    await generator.createBody({ code: 'est' });
                    expect(1).toEqual(0);
                } catch (err) {
                    expect(err).toHaveProperty('errors');
                    expect(err.errors.length).toEqual(1);
                    expect(err.errors[0].type).toEqual('unique violation');
                    expect(err.errors[0].path).toEqual('code');
                }
            });
        });
    });

    describe('Permissions', () => {
        test('should be unique', async () => {
            await generator.createPermission({ scope: 'global', action: 'action', object: 'object' });
            try {
                await generator.createPermission({ scope: 'global', action: 'action', object: 'object' });
                expect(1).toEqual(0);
            } catch (err) {
                expect(err).toHaveProperty('errors');
                expect(err.errors.length).toEqual(3);
                expect(err.errors[0].type).toEqual('unique violation');
                expect(err.errors[1].type).toEqual('unique violation');
                expect(err.errors[2].type).toEqual('unique violation');

                const paths = err.errors.map((error) => error.path);
                expect(paths).toContain('scope');
                expect(paths).toContain('action');
                expect(paths).toContain('object');
            }
        });

        test('should be unique case insensitive', async () => {
            await generator.createPermission({ scope: 'global', action: 'action', object: 'object' });
            try {
                await generator.createPermission({ scope: 'global', action: 'ACTION', object: 'OBJECT' });
                expect(1).toEqual(0);
            } catch (err) {
                expect(err).toHaveProperty('errors');
                expect(err.errors.length).toEqual(3);
                expect(err.errors[0].type).toEqual('unique violation');
                expect(err.errors[1].type).toEqual('unique violation');
                expect(err.errors[2].type).toEqual('unique violation');

                const paths = err.errors.map((error) => error.path);
                expect(paths).toContain('scope');
                expect(paths).toContain('action');
                expect(paths).toContain('object');
            }
        });

        test('should be unique with tabs/spaces', async () => {
            await generator.createPermission({ scope: 'global', action: 'action', object: 'object' });
            try {
                await generator.createPermission({ scope: 'global', action: '  action  ', object: '\t\tobject\t\t' });
                expect(1).toEqual(0);
            } catch (err) {
                expect(err).toHaveProperty('errors');
                expect(err.errors.length).toEqual(3);
                expect(err.errors[0].type).toEqual('unique violation');
                expect(err.errors[1].type).toEqual('unique violation');
                expect(err.errors[2].type).toEqual('unique violation');

                const paths = err.errors.map((error) => error.path);
                expect(paths).toContain('scope');
                expect(paths).toContain('action');
                expect(paths).toContain('object');
            }
        });
    });

    describe('Mail confirmations', () => {
        test('should be unique', async () => {
            const user = await generator.createUser();
            await generator.createMailConfirmation(user, { value: 'test' });
            try {
                await generator.createMailConfirmation(user, { value: 'test' });
                expect(1).toEqual(0);
            } catch (err) {
                expect(err).toHaveProperty('errors');
                expect(err.errors.length).toEqual(1);
                expect(err.errors[0].type).toEqual('unique violation');
                expect(err.errors[0].path).toContain('value');
            }
        });
    });

    describe('Access tokens', () => {
        test('should be unique', async () => {
            const user = await generator.createUser();
            await generator.createAccessToken(user, { value: 'test' });
            try {
                await generator.createAccessToken(user, { value: 'test' });
                expect(1).toEqual(0);
            } catch (err) {
                expect(err).toHaveProperty('errors');
                expect(err.errors.length).toEqual(1);
                expect(err.errors[0].type).toEqual('unique violation');
                expect(err.errors[0].path).toContain('value');
            }
        });
    });

    describe('Refresh tokens', () => {
        test('should be unique', async () => {
            const user = await generator.createUser();
            await generator.createRefreshToken(user, { value: 'test' });
            try {
                await generator.createRefreshToken(user, { value: 'test' });
                expect(1).toEqual(0);
            } catch (err) {
                expect(err).toHaveProperty('errors');
                expect(err.errors.length).toEqual(1);
                expect(err.errors[0].type).toEqual('unique violation');
                expect(err.errors[0].path).toContain('value');
            }
        });
    });

    describe('Mail change', () => {
        test('should be unique', async () => {
            const user = await generator.createUser();
            await generator.createMailChange(user, { value: 'test' });
            try {
                await generator.createMailChange(user, { value: 'test' });
                expect(1).toEqual(0);
            } catch (err) {
                expect(err).toHaveProperty('errors');
                expect(err.errors.length).toEqual(1);
                expect(err.errors[0].type).toEqual('unique violation');
                expect(err.errors[0].path).toContain('value');
            }
        });
    });

    describe('Circle permissions', () => {
        test('should be unique', async () => {
            const circle = await generator.createCircle();
            const permission = await generator.createPermission();
            await generator.createCirclePermission(circle, permission);
            try {
                await generator.createCirclePermission(circle, permission);
                expect(1).toEqual(0);
            } catch (err) {
                expect(err).toHaveProperty('errors');
                expect(err.errors.length).toEqual(2);
                expect(err.errors[0].type).toEqual('unique violation');
                expect(err.errors[1].type).toEqual('unique violation');

                const paths = err.errors.map((error) => error.path);
                expect(paths).toContain('circle_id');
                expect(paths).toContain('permission_id');
            }
        });
    });

    describe('Circle memberships', () => {
        test('should be unique', async () => {
            const circle = await generator.createCircle();
            const user = await generator.createUser();
            await generator.createCircleMembership(circle, user);
            try {
                await generator.createCircleMembership(circle, user);
                expect(1).toEqual(0);
            } catch (err) {
                expect(err).toHaveProperty('errors');
                expect(err.errors.length).toEqual(2);
                expect(err.errors[0].type).toEqual('unique violation');
                expect(err.errors[1].type).toEqual('unique violation');

                const paths = err.errors.map((error) => error.path);
                expect(paths).toContain('circle_id');
                expect(paths).toContain('user_id');
            }
        });
    });

    describe('Body membership', () => {
        test('should be unique', async () => {
            const body = await generator.createBody();
            const user = await generator.createUser();
            await generator.createBodyMembership(body, user);
            try {
                await generator.createBodyMembership(body, user);
                expect(1).toEqual(0);
            } catch (err) {
                expect(err).toHaveProperty('errors');
                expect(err.errors.length).toEqual(2);
                expect(err.errors[0].type).toEqual('unique violation');
                expect(err.errors[1].type).toEqual('unique violation');

                const paths = err.errors.map((error) => error.path);
                expect(paths).toContain('body_id');
                expect(paths).toContain('user_id');
            }
        });
    });

    describe('Join requests', () => {
        test('should be unique', async () => {
            const body = await generator.createBody();
            const user = await generator.createUser();
            await generator.createJoinRequest(body, user);
            try {
                await generator.createJoinRequest(body, user);
                expect(1).toEqual(0);
            } catch (err) {
                expect(err).toHaveProperty('errors');
                expect(err.errors.length).toEqual(2);
                expect(err.errors[0].type).toEqual('unique violation');
                expect(err.errors[1].type).toEqual('unique violation');

                const paths = err.errors.map((error) => error.path);
                expect(paths).toContain('body_id');
                expect(paths).toContain('user_id');
            }
        });
    });
});
