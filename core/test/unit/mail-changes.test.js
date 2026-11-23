const { startServer, stopServer } = require('../../lib/server');
const generator = require('../scripts/generator');
const { MailChange } = require('../../models');
const constants = require('../../lib/constants');
const { sequelize, Sequelize } = require('../../lib/sequelize');
const migration = require('../../migrations/20261123120000-add-current-address-confirmation-to-mail-changes');

describe('Mail changes', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should fail with null new_email', async () => {
        try {
            const user = await generator.createUser();
            await generator.createMailChange(user, { new_email: null });
            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].path).toEqual('new_email');
        }
    });

    test('should fail with empty new_email', async () => {
        try {
            const user = await generator.createUser();
            await generator.createMailChange(user, { new_email: '' });
            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(2);
            expect(err.errors[0].path).toEqual('new_email');
            expect(err.errors[1].path).toEqual('new_email');
        }
    });

    test('should fail with invalid new_email', async () => {
        try {
            const user = await generator.createUser();
            await generator.createMailChange(user, { new_email: 'test' });
            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].path).toEqual('new_email');
        }
    });

    test('should fail with invalid new_email (aegee.eu)', async () => {
        try {
            const user = await generator.createUser();
            await generator.createMailChange(user, { new_email: 'test@aegee.eu' });
            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].path).toEqual('new_email');
        }
    });

    test('should fail with invalid new_email (aegee.org)', async () => {
        try {
            const user = await generator.createUser();
            await generator.createMailChange(user, { new_email: 'test@aegee.org' });
            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].path).toEqual('new_email');
        }
    });

    test('should normalize fields', async () => {
        const user = await generator.createUser();
        const permission = await MailChange.create({
            user_id: user.id,
            value: 'aaa',
            expires_at: new Date(),
            new_email: '\t\t\t email@email.test\t   \t',
            old_email: user.email
        });
        expect(permission.new_email).toEqual('email@email.test');
    });

    test('should fail without old_email', async () => {
        try {
            const user = await generator.createUser();
            await generator.createMailChange(user, { old_email: null });
            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].path).toEqual('old_email');
        }
    });

    test('should fail with an old_value that is used already', async () => {
        try {
            const user = await generator.createUser();
            await generator.createMailChange(user, { old_value: 'test' });
            await generator.createMailChange(user, { old_value: 'test' });
            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].type).toEqual('unique violation');
            expect(err.errors[0].path).toContain('old_value');
        }
    });

    describe('createForUser', () => {
        test('should only create a token for the new address by default', async () => {
            const user = await generator.createUser({ email: 'current@example.com' });
            const mailChange = await MailChange.createForUser(user, 'new@example.com');

            expect(mailChange.value.length).toEqual(constants.TOKEN_LENGTH.MAIL_CHANGE);
            expect(mailChange.old_value).toBeNull();
            expect(mailChange.old_email).toEqual('current@example.com');
            expect(mailChange.new_email).toEqual('new@example.com');
            expect(mailChange.requested_by).toBeNull();
            expect(mailChange.new_confirmed_at).toBeFalsy();
            expect(mailChange.old_confirmed_at).toBeFalsy();
        });

        test('should create a token for both addresses if asked', async () => {
            const requester = await generator.createUser();
            const user = await generator.createUser();
            const mailChange = await MailChange.createForUser(user, 'new@example.com', {
                requestedBy: requester.id,
                needsOldConfirmation: true
            });

            expect(mailChange.value.length).toEqual(constants.TOKEN_LENGTH.MAIL_CHANGE);
            expect(mailChange.old_value.length).toEqual(constants.TOKEN_LENGTH.MAIL_CHANGE);
            expect(mailChange.old_value).not.toEqual(mailChange.value);
            expect(mailChange.requested_by).toEqual(requester.id);
        });
    });

    describe('waitingFor', () => {
        test('should wait for the new address only if there is no token for the current one', async () => {
            const user = await generator.createUser();
            const mailChange = await generator.createMailChange(user);
            expect(mailChange.waitingFor()).toEqual('new_email');

            mailChange.new_confirmed_at = new Date();
            expect(mailChange.waitingFor()).toBeNull();
        });

        test('should wait for both addresses if there is a token for the current one', async () => {
            const user = await generator.createUser();
            const mailChange = await generator.createMailChange(user, { old_value: 'test' });
            expect(mailChange.waitingFor()).toEqual('new_email');

            mailChange.new_confirmed_at = new Date();
            expect(mailChange.waitingFor()).toEqual('old_email');

            mailChange.old_confirmed_at = new Date();
            expect(mailChange.waitingFor()).toBeNull();
        });
    });

    describe('migration', () => {
        test('should remove the changes that were pending and add the columns', async () => {
            const queryInterface = sequelize.getQueryInterface();
            const countChanges = async () => {
                const [rows] = await sequelize.query('SELECT count(*)::int AS count FROM mail_changes');
                return rows[0].count;
            };

            const user = await generator.createUser();
            await generator.createMailChange(user, { old_value: 'test' });

            await migration.down(queryInterface, Sequelize);
            try {
                // Undoing it removes them as well.
                expect(await countChanges()).toEqual(0);

                const before = await queryInterface.describeTable('mail_changes');
                expect(before).not.toHaveProperty('old_value');

                await sequelize.query(
                    'INSERT INTO mail_changes (user_id, value, new_email, expires_at, created_at, updated_at) '
                    + 'VALUES (:user_id, \'pending\', \'new@example.com\', now(), now(), now())',
                    { replacements: { user_id: user.id } }
                );
            } finally {
                await migration.up(queryInterface, Sequelize);
            }

            expect(await countChanges()).toEqual(0);

            const after = await queryInterface.describeTable('mail_changes');
            for (const column of ['old_value', 'old_email', 'new_confirmed_at', 'old_confirmed_at', 'requested_by']) {
                expect(after).toHaveProperty(column);
            }
            expect(after.old_email.allowNull).toEqual(false);
            expect(after.old_value.allowNull).toEqual(true);
        });
    });
});
