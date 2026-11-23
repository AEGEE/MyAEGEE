const moment = require('moment');

const { startServer, stopServer } = require('../../lib/server');
const generator = require('../scripts/generator');
const cron = require('../../lib/cron');
const logger = require('../../lib/logger');
const config = require('../../config');
const { User, RefreshToken, MailChange } = require('../../models');

describe('Cron testing', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    afterEach(async () => {
        await generator.clearAll();
        await cron.clearAll();
    });

    test('should add job', async () => {
        expect(Object.keys(cron.jobs).length).toEqual(0);

        cron.addJob(cron.JOB_TYPES.DELETE_NOT_CONFIRMED_USERS);
        expect(Object.keys(cron.jobs).length).toEqual(1);
    });

    test('should execute job', async () => {
        expect(Object.keys(cron.jobs).length).toEqual(0);

        cron.addJob(cron.JOB_TYPES.DELETE_NOT_CONFIRMED_USERS);
        expect(Object.keys(cron.jobs).length).toEqual(1);

        const jobKey = Object.keys(cron.jobs)[0];
        await cron.executeJob(jobKey);
    });

    test('should stop the scheduled task when cancelling a job', async () => {
        const id = cron.addJob(cron.JOB_TYPES.DELETE_NOT_CONFIRMED_USERS);
        const { job } = cron.jobs[id];
        const destroy = jest.spyOn(job, 'destroy');

        cron.cancelJob(id);

        expect(destroy).toHaveBeenCalled();
        expect(job.getStatus()).toEqual('destroyed');
        expect(cron.jobs[id]).toBeUndefined();
    });

    test('should not fail when cancelling a job that is not found', async () => {
        expect(() => cron.cancelJob(1337)).not.toThrow();
    });

    test('should not execute a job if it\'s not found', async () => {
        expect(Object.keys(cron.jobs).length).toEqual(0);
        await cron.executeJob(1337);
    });

    test('should register all tasks', async () => {
        expect(Object.keys(cron.jobs).length).toEqual(0);

        cron.registerAllTasks();
        expect(Object.keys(cron.jobs).length).toEqual(3);
    });

    describe('DELETE_NOT_CONFIRMED_USERS', () => {
        test('should work properly', async () => {
            const userActivated = await generator.createUser();
            const userWithValidConfirmation = await generator.createUser();
            const userWithoutValidConfirmation = await generator.createUser();

            await generator.createMailConfirmation(userWithValidConfirmation, { expires_at: moment().add(1, 'day') });
            await generator.createMailConfirmation(userWithoutValidConfirmation, { expires_at: moment().subtract(1, 'day') });

            cron.addJob(cron.JOB_TYPES.DELETE_NOT_CONFIRMED_USERS);
            expect(Object.keys(cron.jobs).length).toEqual(1);

            const jobKey = Object.keys(cron.jobs)[0];
            await cron.executeJob(jobKey);

            // first and second should be left as they are, third should be removed.
            const usersFromDb = await User.findAll();
            expect(usersFromDb.length).toEqual(2);

            const ids = usersFromDb.map((u) => u.id);
            expect(ids).toContain(userActivated.id);
            expect(ids).toContain(userWithValidConfirmation.id);
        });
    });

    describe('DELETE_NOT_CONFIRMED_USERS logging', () => {
        test('should log the ids of deleted users, and not their emails', async () => {
            const user = await generator.createUser({ username: 'unconfirmed-log-marker' });
            await generator.createMailConfirmation(user, { expires_at: moment().subtract(1, 'day') });

            const written = [];
            jest.spyOn(logger, 'info').mockImplementation((...args) => {
                written.push(args);
            });

            try {
                await cron.JOB_TYPES.DELETE_NOT_CONFIRMED_USERS.callback();
            } finally {
                jest.restoreAllMocks();
            }

            const logged = JSON.stringify(written);
            expect(logged).toContain(`"user_id":${user.id}`);
            expect(logged).not.toContain(user.email);
            expect(logged).not.toContain('unconfirmed-log-marker');
        });
    });

    describe('DELETE_ROTATED_REFRESH_TOKENS', () => {
        test('should only delete rotated tokens after the grace period', async () => {
            const user = await generator.createUser();
            const notRotated = await generator.createRefreshToken(user);
            const withinGrace = await generator.createRefreshToken(user, {
                rotated_at: moment().subtract(config.ttl.refresh_token_grace_period - 10, 'seconds').toDate()
            });
            await generator.createRefreshToken(user, {
                rotated_at: moment().subtract(config.ttl.refresh_token_grace_period + 10, 'seconds').toDate()
            });

            const jobId = cron.addJob(cron.JOB_TYPES.DELETE_ROTATED_REFRESH_TOKENS);
            await cron.executeJob(jobId);

            const tokensFromDb = await RefreshToken.findAll();
            expect(tokensFromDb.map((t) => t.id).sort()).toEqual([notRotated.id, withinGrace.id].sort());
        });
    });

    describe('DELETE_EXPIRED_MAIL_CHANGES', () => {
        test('should only delete the email changes that are expired', async () => {
            const user = await generator.createUser();
            const otherUser = await generator.createUser();
            const pending = await generator.createMailChange(user, { expires_at: moment().add(1, 'hour').toDate() });
            await generator.createMailChange(user, { expires_at: moment().subtract(1, 'minute').toDate() });
            await generator.createMailChange(otherUser, {
                expires_at: moment().subtract(3, 'days').toDate(),
                old_value: 'old-token',
                requested_by: user.id
            });

            const jobId = cron.addJob(cron.JOB_TYPES.DELETE_EXPIRED_MAIL_CHANGES);
            await cron.executeJob(jobId);

            const changesFromDb = await MailChange.findAll();
            expect(changesFromDb.map((change) => change.id)).toEqual([pending.id]);
        });

        test('should log how many it deleted, and nothing about them', async () => {
            const user = await generator.createUser();
            await generator.createMailChange(user, {
                new_email: 'expired-change-marker@example.com',
                expires_at: moment().subtract(1, 'minute').toDate()
            });

            const written = [];
            jest.spyOn(logger, 'info').mockImplementation((...args) => {
                written.push(args);
            });

            try {
                await cron.JOB_TYPES.DELETE_EXPIRED_MAIL_CHANGES.callback();
            } finally {
                jest.restoreAllMocks();
            }

            expect(written).toEqual([[{ deleted: 1 }, 'Deleted expired email changes']]);
        });
    });
});
