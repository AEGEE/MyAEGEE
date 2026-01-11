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
        const user = await generator.createUser({ gsuite_id: 'test@aegee.eu', primary_email: 'gsuite' });
        expect(user.notification_email).toEqual('test@aegee.eu');
    });

    test('should fail with not valid email (aegee.eu)', async () => {
        try {
            await generator.createUser({ email: 'test@aegee.eu' });
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
            await generator.createUser({ email: 'test@aegee.org' });
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
            username: '\t\t\tSERGEY\t ',
            first_name: '  \t Sergey\t  \t',
            last_name: '\t   \tPeshkov\t\t\t',
            gender: '    male    ',
            email: '\t\tTEST@test.io   ',
            phone: '\t123    ',
            address: '\t\t\t123  ',
            about_me: '\t\t\t\t\t'
        });

        const user = await User.create(data);
        expect(user.username).toEqual('sergey');
        expect(user.first_name).toEqual('Sergey');
        expect(user.last_name).toEqual('Peshkov');
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
});
