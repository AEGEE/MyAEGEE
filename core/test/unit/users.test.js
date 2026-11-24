const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const generator = require('../scripts/generator');
const { User } = require('../../models');

describe('Users testing', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    test('should fail with not valid first_name', async () => {
        try {
            await generator.createUser({ first_name: '\t\t\n\n\t' });
            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].type).toEqual('Validation error');
            expect(err.errors[0].path).toEqual('first_name');
        }
    });

    test('should fail with null first_name', async () => {
        try {
            await generator.createUser({ first_name: null });
            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].type).toEqual('notNull Violation');
            expect(err.errors[0].path).toEqual('first_name');
        }
    });

    test('should fail with not set first_name', async () => {
        try {
            const user = generator.generateUser();
            delete user.first_name;

            await User.create(user);

            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].type).toEqual('notNull Violation');
            expect(err.errors[0].path).toEqual('first_name');
        }
    });

    test('should fail with not valid last_name', async () => {
        try {
            await generator.createUser({ last_name: '\t\t\n\n\t' });
            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].type).toEqual('Validation error');
            expect(err.errors[0].path).toEqual('last_name');
        }
    });

    test('should fail with null last_name', async () => {
        try {
            await generator.createUser({ last_name: null });
            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].type).toEqual('notNull Violation');
            expect(err.errors[0].path).toEqual('last_name');
        }
    });

    test('should fail with not set last_name', async () => {
        try {
            const user = generator.generateUser();
            delete user.last_name;

            await User.create(user);

            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].type).toEqual('notNull Violation');
            expect(err.errors[0].path).toEqual('last_name');
        }
    });

    test('should return gsuite id', async () => {
        const user = await generator.createUser({ gsuite_id: 'example-test@aegee.eu', primary_email: 'gsuite' });
        expect(user.notification_email).toEqual('example-test@aegee.eu');
    });

    test('should fail with a gsuite id that is not an email', async () => {
        try {
            await generator.createUser({ gsuite_id: 'not-an-email' });
            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.map((error) => error.path)).toContain('gsuite_id');
        }
    });

    test('should fail with a gsuite id outside of the AEGEE domains', async () => {
        try {
            await generator.createUser({ gsuite_id: 'test@example.com' });
            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].type).toEqual('Validation error');
            expect(err.errors[0].path).toEqual('gsuite_id');
        }
    });

    test('should fail with a gsuite id that only looks like an AEGEE domain', async () => {
        try {
            await generator.createUser({ gsuite_id: 'test@notaegee.eu' });
            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].path).toEqual('gsuite_id');
        }
    });

    test('should accept a gsuite id on both AEGEE domains', async () => {
        const first = await generator.createUser({ gsuite_id: 'example-first@aegee.eu' });
        const second = await generator.createUser({ gsuite_id: 'example-Second@AEGEE.org' });

        expect(first.gsuite_id).toEqual('example-first@aegee.eu');
        expect(second.gsuite_id).toEqual('example-second@aegee.org');
    });

    test('should accept no gsuite id', async () => {
        const user = await generator.createUser({ gsuite_id: null });
        expect(user.gsuite_id).toBeNull();
    });

    test('should fail with not valid email (aegee.eu)', async () => {
        try {
            await generator.createUser({ email: 'example-test@aegee.eu' });
            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].type).toEqual('Validation error');
            expect(err.errors[0].path).toEqual('email');
        }
    });

    test('should fail with not valid email (aegee.org)', async () => {
        try {
            await generator.createUser({ email: 'example-test@aegee.org' });
            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].type).toEqual('Validation error');
            expect(err.errors[0].path).toEqual('email');
        }
    });

    test('should allow null date_of_birth', async () => {
        const user = generator.generateUser();
        delete user.date_of_birth;

        await User.create(user);
    });

    test('should allow empty string date_of_birth', async () => {
        const user = generator.generateUser({ date_of_birth: '' });
        await User.create(user);
    });

    test('should fail with date_of_birth in the future', async () => {
        try {
            const user = generator.generateUser({
                date_of_birth: moment().add(1, 'year').toDate()
            });
            await User.create(user);

            expect(1).toEqual(0);
        } catch (err) {
            expect(err).toHaveProperty('errors');
            expect(err.errors.length).toEqual(1);
            expect(err.errors[0].type).toEqual('Validation error');
            expect(err.errors[0].path).toEqual('date_of_birth');
        }
    });

    test('should normalize fields', async () => {
        const data = generator.generateUser({
            username: '\t\t\tQUILLON\t ',
            first_name: '  \t Quillon\t  \t',
            last_name: '\t   \tExampleton\t\t\t',
            gender: '    male    ',
            email: '\t\tTEST@test.io   ',
            phone: '\t123    ',
            address: '\t\t\t123  ',
            about_me: '\t\t\t\t\t'
        });

        const user = await User.create(data);
        expect(user.username).toEqual('quillon');
        expect(user.first_name).toEqual('Quillon');
        expect(user.last_name).toEqual('Exampleton');
        expect(user.gender).toEqual('male');
        expect(user.email).toEqual('test@test.io');
        expect(user.phone).toEqual('123');
        expect(user.about_me).toEqual('');
    });

    test('should not normalize fields which are not there', async () => {
        const data = generator.generateUser({
            gender: null,
            phone: null,
            address: null,
            about_me: null
        });

        const user = await User.create(data);
        expect(user.gender).toEqual(null);
        expect(user.phone).toEqual(null);
        expect(user.address).toEqual(null);
        expect(user.about_me).toEqual(null);
    });

    describe('validation rules', () => {
        // Every message of the fields that are wrong, by field.
        const validationErrors = async (fields) => {
            try {
                await User.create(generator.generateUser(fields));
            } catch (err) {
                expect(err.name).toMatch(/^Sequelize(Validation|UniqueConstraint)Error$/);

                const messages = {};
                for (const error of err.errors) {
                    messages[error.path] = [...(messages[error.path] || []), error.message].sort();
                }
                return messages;
            }

            return null;
        };

        test.each([
            ['username', '', ['Username should be set.']],
            ['username', null, ['Username should be set.']],
            ['username', 'user name', ['Username should only contain letters, numbers, dots, underscores and dashes.']],
            ['username', 'üser', ['Username should only contain letters, numbers, dots, underscores and dashes.']],
            ['username', '12.34_5-6', ['Username should have at least 1 letter.']],
            ['email', '', ['Email should be set.', 'Email should be valid.']],
            ['email', null, ['Email should be set.']],
            ['email', 'not-an-email', ['Email should be valid.']],
            ['email', 'some.one@', ['Email should be valid.']],
            ['email', 'some one@example.com', ['Email should be valid.']],
            ['email', 'example-some.one@aegee.eu', ['Email can not be in one of the following domains: aegee.org, aegee.eu.']],
            ['password', '', ['Password should be at least 8 characters long.', 'Password should be set.']],
            ['password', null, ['Password should be set.']],
            ['password', '1234567', ['Password should be at least 8 characters long.']],
            ['first_name', '', ['First name should be set.']],
            ['first_name', 'Some1', ['First name should only contain letters, spaces and dashes, got "Some1".']],
            ['last_name', '', ['Last name should be set.']],
            ['last_name', 'One_', ['Last name should only contain letters, spaces and dashes, got "One_".']],
            ['date_of_birth', 'abc', ['Birthday should be a valid date.']],
            ['date_of_birth', '2999-01-01', ['Birthday should be in the past.']],
            ['privacy_consent', 'abc', ['Privacy consent should be a valid date.']],
            ['active', 'abc', ['Active should be valid.']],
            ['superadmin', 'abc', ['Superadmin should be valid.']],
            ['primary_email', 'work', ['Primary email should be one of these: "personal", "gsuite".']],
            ['primary_email', '', ['Primary email should be one of these: "personal", "gsuite".']],
            ['gsuite_id', 'not-an-email', [
                'GSuite ID should be a valid email.',
                'GSuite ID should be in one of the following domains: aegee.org, aegee.eu.'
            ]],
            ['gsuite_id', 'some.one@example.com', ['GSuite ID should be in one of the following domains: aegee.org, aegee.eu.']]
        ])('should refuse %s %j', async (field, value, messages) => {
            expect(await validationErrors({ [field]: value })).toEqual({ [field]: [...messages].sort() });
            expect(await User.count()).toEqual(0);
        });

        test.each([
            ['username', 'some.one_2-b'],
            ['email', 'some.one+tag@sub.example.com'],
            ['password', '12345678'],
            ['first_name', 'Anne-Marie d\'Été'],
            ['last_name', 'van der Ångström Jr.'],
            ['date_of_birth', '1995-03-17'],
            ['primary_email', 'personal']
        ])('should accept %s %j', async (field, value) => {
            const user = await User.create(generator.generateUser({ [field]: value }));

            expect(user.id).toEqual(expect.any(Number));
        });

        test('should name every field that is wrong at once', async () => {
            expect(await validationErrors({ username: '1', email: 'x', first_name: '1', primary_email: 'x' })).toEqual({
                username: ['Username should have at least 1 letter.'],
                email: ['Email should be valid.'],
                first_name: ['First name should only contain letters, spaces and dashes, got "1".'],
                primary_email: ['Primary email should be one of these: "personal", "gsuite".']
            });
        });

        test('should refuse the Google Workspace account as primary email only in the routes, not in the model', async () => {
            // The routes check it, so that a member who is stored like this can still be edited.
            const user = await User.create(generator.generateUser({ primary_email: 'gsuite', gsuite_id: null }));

            expect(user.primary_email).toEqual('gsuite');
            expect(user.notification_email).toBeNull();
        });

        test.each([
            ['the same', 'example-taken@aegee.eu'],
            ['in another case', 'example-Taken@AEGEE.eu'],
            ['with spaces around it', '\t example-taken@aegee.eu ']
        ])('should refuse a Google Workspace account that another member has (%s)', async (name, value) => {
            await generator.createUser({ gsuite_id: 'example-taken@aegee.eu' });

            expect(await validationErrors({ gsuite_id: value })).toEqual({ gsuite_id: ['gsuite_id must be unique'] });
            expect(await User.count()).toEqual(1);
        });

        test('should accept several members without a Google Workspace account', async () => {
            await generator.createUser({ gsuite_id: null });
            await generator.createUser({ gsuite_id: null });

            expect(await User.count()).toEqual(2);
        });

        test('should accept the login email of one member as the Google Workspace account of nobody', async () => {
            // The two can't be the same address: the login email is never on the AEGEE domains,
            // the Google Workspace account always is.
            await generator.createUser({ email: 'some.one@example.com' });

            expect(await validationErrors({ gsuite_id: 'some.one@example.com' })).toEqual({
                gsuite_id: ['GSuite ID should be in one of the following domains: aegee.org, aegee.eu.']
            });
        });
    });

    describe('password', () => {
        test('should be stored as a hash and checked against it', async () => {
            const user = await generator.createUser({ password: 'a-secret-password' });
            const stored = await User.scope('withPassword').findByPk(user.id);

            expect(stored.password).not.toEqual('a-secret-password');
            expect(await stored.checkPassword('a-secret-password')).toEqual(true);
            expect(await stored.checkPassword('another-password')).toEqual(false);
        });

        test('should be hashed again when it changes, and left alone when something else changes', async () => {
            const user = await generator.createUser({ password: 'a-secret-password' });
            const stored = await User.scope('withPassword').findByPk(user.id);
            const firstHash = stored.password;

            await stored.update({ first_name: 'Changed' });
            expect((await User.scope('withPassword').findByPk(user.id)).password).toEqual(firstHash);

            await stored.update({ password: 'another-password' });
            const changed = await User.scope('withPassword').findByPk(user.id);
            expect(changed.password).not.toEqual(firstHash);
            expect(await changed.checkPassword('another-password')).toEqual(true);
        });

        test('should not be read by default', async () => {
            const user = await generator.createUser();

            const byDefault = await User.findByPk(user.id);
            expect(byDefault.password).toBeUndefined();
            expect(JSON.parse(JSON.stringify(byDefault))).not.toHaveProperty('password');
        });
    });

    describe('notification email', () => {
        test('should be the login email by default', async () => {
            const user = await generator.createUser({ email: 'some.one@example.com', gsuite_id: 'example-some.one@aegee.eu' });

            expect(user.primary_email).toEqual('personal');
            expect(user.notification_email).toEqual('some.one@example.com');
        });

        test('should be in the JSON of a member', async () => {
            const user = await generator.createUser({ email: 'some.one@example.com' });

            expect(JSON.parse(JSON.stringify(user)).notification_email).toEqual('some.one@example.com');
        });
    });
});
