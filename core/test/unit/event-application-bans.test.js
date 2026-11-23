const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const generator = require('../scripts/generator');
const { EventApplicationBan } = require('../../models');

describe('Event application bans testing', () => {
    let user;
    let banner;

    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        user = await generator.createUser();
        banner = await generator.createUser();
    });

    afterEach(async () => {
        await generator.clearAll();
    });

    // Every message of the fields that are wrong, by field.
    const validationErrors = async (fields) => {
        try {
            await EventApplicationBan.create({
                user_id: user.id,
                banned_by_user_id: banner.id,
                ban_until: moment().add(1, 'month').toDate(),
                ...fields
            });
        } catch (err) {
            expect(err.name).toEqual('SequelizeValidationError');

            const messages = {};
            for (const error of err.errors) {
                messages[error.path] = [...(messages[error.path] || []), error.message].sort();
            }
            return messages;
        }

        return null;
    };

    describe('validation rules', () => {
        test('should accept a ban that ends in the future', async () => {
            const banUntil = moment().add(1, 'month').milliseconds(0).toDate();

            const ban = await EventApplicationBan.create({
                user_id: user.id,
                banned_by_user_id: banner.id,
                ban_until: banUntil
            });

            const stored = await EventApplicationBan.findByPk(ban.id);
            expect(stored.user_id).toEqual(user.id);
            expect(stored.banned_by_user_id).toEqual(banner.id);
            expect(stored.ban_until.getTime()).toEqual(banUntil.getTime());
            expect(stored.lifted_at).toBeNull();
            expect(stored.lifted_by_user_id).toBeNull();
        });

        test.each([
            ['yesterday', () => moment().subtract(1, 'day').toDate()],
            ['a second ago', () => moment().subtract(1, 'second').toDate()],
            ['a past date as a text', () => '2001-01-01T00:00:00.000Z']
        ])('should refuse a ban that ended %s', async (name, banUntil) => {
            expect(await validationErrors({ ban_until: banUntil() })).toEqual({
                ban_until: ['Ban end date should be in the future.']
            });
            expect(await EventApplicationBan.count()).toEqual(0);
        });

        test('should refuse a ban without an end date', async () => {
            expect(await validationErrors({ ban_until: null })).toEqual({
                ban_until: ['event_application_ban.ban_until cannot be null']
            });
            expect(await EventApplicationBan.count()).toEqual(0);
        });

        test('should refuse an end date that is not a date', async () => {
            const errors = await validationErrors({ ban_until: 'not a date' });

            expect(Object.keys(errors)).toEqual(['ban_until']);
            expect(errors.ban_until).toContain('Ban end date should be valid.');
            expect(await EventApplicationBan.count()).toEqual(0);
        });

        test.each([
            ['user_id', 'User ID should be a number.'],
            ['banned_by_user_id', 'Banning user ID should be a number.'],
            ['lifted_by_user_id', 'Lifting user ID should be a number.']
        ])('should refuse a %s that is not a number', async (field, message) => {
            const errors = await validationErrors({ [field]: 'abc' });

            expect(Object.keys(errors)).toEqual([field]);
            expect(errors[field]).toContain(message);
            expect(await EventApplicationBan.count()).toEqual(0);
        });

        test.each([
            ['user_id', 'event_application_ban.user_id cannot be null'],
            ['banned_by_user_id', 'event_application_ban.banned_by_user_id cannot be null']
        ])('should refuse a ban without a %s', async (field, message) => {
            expect(await validationErrors({ [field]: null })).toEqual({ [field]: [message] });
            expect(await EventApplicationBan.count()).toEqual(0);
        });

        test('should refuse a lift date that is not a date', async () => {
            const errors = await validationErrors({ lifted_at: 'not a date' });

            expect(Object.keys(errors)).toEqual(['lifted_at']);
            expect(errors.lifted_at).toContain('Lift date should be valid.');
        });

        test('should let a ban that has ended be marked as lifted', async () => {
            // The end date is checked when it is set, not on every later change of the ban.
            const ban = await EventApplicationBan.create({
                user_id: user.id,
                banned_by_user_id: banner.id,
                ban_until: moment().subtract(1, 'day').toDate()
            }, { validate: false });

            await ban.update({ lifted_at: new Date(), lifted_by_user_id: banner.id }, { fields: ['lifted_at', 'lifted_by_user_id'] });

            const stored = await EventApplicationBan.findByPk(ban.id);
            expect(stored.lifted_by_user_id).toEqual(banner.id);
        });
    });

    describe('findActiveForUser', () => {
        test('should find nothing for a member who was never banned', async () => {
            expect(await EventApplicationBan.findActiveForUser(user.id)).toBeNull();
        });

        test('should find the ban that runs', async () => {
            const ban = await generator.createEventApplicationBan(user, banner, { ban_until: moment().add(1, 'month').toDate() });

            const active = await EventApplicationBan.findActiveForUser(user.id);
            expect(active.id).toEqual(ban.id);
        });

        test('should not find a ban that was lifted', async () => {
            await generator.createEventApplicationBan(user, banner, {
                ban_until: moment().add(1, 'month').toDate(),
                lifted_at: new Date(),
                lifted_by_user_id: banner.id
            });

            expect(await EventApplicationBan.findActiveForUser(user.id)).toBeNull();
        });

        test('should not find a ban that has ended', async () => {
            await EventApplicationBan.create({
                user_id: user.id,
                banned_by_user_id: banner.id,
                ban_until: moment().subtract(1, 'minute').toDate()
            }, { validate: false });

            expect(await EventApplicationBan.findActiveForUser(user.id)).toBeNull();
        });

        test('should not find the ban of another member', async () => {
            await generator.createEventApplicationBan(banner, user, { ban_until: moment().add(1, 'month').toDate() });

            expect(await EventApplicationBan.findActiveForUser(user.id)).toBeNull();
        });

        test('should find the ban that runs next to older ones that were lifted', async () => {
            await generator.createEventApplicationBan(user, banner, {
                ban_until: moment().add(2, 'months').toDate(),
                lifted_at: new Date(),
                lifted_by_user_id: banner.id
            });
            await EventApplicationBan.create({
                user_id: user.id,
                banned_by_user_id: banner.id,
                ban_until: moment().subtract(1, 'day').toDate(),
                lifted_at: new Date(),
                lifted_by_user_id: banner.id
            }, { validate: false });
            const ban = await generator.createEventApplicationBan(user, banner, { ban_until: moment().add(1, 'month').toDate() });

            const active = await EventApplicationBan.findActiveForUser(user.id);
            expect(active.id).toEqual(ban.id);
        });
    });

    describe('one ban that is not lifted per member', () => {
        test('should refuse a second one next to a ban that runs', async () => {
            await generator.createEventApplicationBan(user, banner, { ban_until: moment().add(1, 'month').toDate() });

            await expect(generator.createEventApplicationBan(user, banner, { ban_until: moment().add(2, 'months').toDate() }))
                .rejects.toMatchObject({ name: 'SequelizeUniqueConstraintError' });

            expect(await EventApplicationBan.count()).toEqual(1);
        });

        test('should refuse a second one next to a ban that has ended and was not lifted', async () => {
            // The route lifts whatever is not lifted before it stores a new ban.
            await EventApplicationBan.create({
                user_id: user.id,
                banned_by_user_id: banner.id,
                ban_until: moment().subtract(1, 'day').toDate()
            }, { validate: false });

            await expect(generator.createEventApplicationBan(user, banner, { ban_until: moment().add(1, 'month').toDate() }))
                .rejects.toMatchObject({ name: 'SequelizeUniqueConstraintError' });

            expect(await EventApplicationBan.count()).toEqual(1);
        });

        test('should accept one for every member', async () => {
            await generator.createEventApplicationBan(user, banner, { ban_until: moment().add(1, 'month').toDate() });
            await generator.createEventApplicationBan(banner, user, { ban_until: moment().add(1, 'month').toDate() });

            expect(await EventApplicationBan.count()).toEqual(2);
        });
    });

    describe('linked members', () => {
        test('should refuse a ban for a member who does not exist', async () => {
            await expect(EventApplicationBan.create({
                user_id: 2147483647,
                banned_by_user_id: banner.id,
                ban_until: moment().add(1, 'month').toDate()
            })).rejects.toMatchObject({ name: 'SequelizeForeignKeyConstraintError' });

            expect(await EventApplicationBan.count()).toEqual(0);
        });
    });
});
