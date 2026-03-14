const moment = require('moment');

const generator = require('../scripts/generator');
const cron = require('../../lib/cron');
const { User } = require('../../models');

describe('Cron testing', () => {
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

    test('should not execute a job if it\'s not found', async () => {
        expect(Object.keys(cron.jobs).length).toEqual(0);
        await cron.executeJob(1337);
    });

    test('should register all tasks', async () => {
        expect(Object.keys(cron.jobs).length).toEqual(0);

        cron.registerAllTasks();
        expect(Object.keys(cron.jobs).length).toEqual(1);
    });

    test('should stop the underlying scheduled task when cancelling', async () => {
        const stop = jest.fn();
        const jobId = cron.addJob(cron.JOB_TYPES.DELETE_NOT_CONFIRMED_USERS);
        cron.jobs[jobId].job.stop = stop;

        cron.cancelJob(jobId);

        expect(stop).toHaveBeenCalledTimes(1);
        expect(cron.jobs[jobId]).toBeUndefined();
    });

    test('should stop all underlying scheduled tasks when clearing', async () => {
        const firstStop = jest.fn();
        const secondStop = jest.fn();
        const firstId = cron.addJob(cron.JOB_TYPES.DELETE_NOT_CONFIRMED_USERS);
        const secondId = cron.addJob(cron.JOB_TYPES.DELETE_NOT_CONFIRMED_USERS);

        cron.jobs[firstId].job.stop = firstStop;
        cron.jobs[secondId].job.stop = secondStop;

        cron.clearAll();

        expect(firstStop).toHaveBeenCalledTimes(1);
        expect(secondStop).toHaveBeenCalledTimes(1);
        expect(Object.keys(cron.jobs)).toHaveLength(0);
    });

    describe('DELETE_NOT_CONFIRMED_USERS', () => {
        test('should work properly', async () => {
            const userActivated = await generator.createUser();
            const userWithValidConfirmation = await generator.createUser();
            const userWithoutValidConfirmation = await generator.createUser();

            await generator.createMailConfirmation(userWithValidConfirmation, { expires_at: moment().add(1, 'day').toDate() });
            await generator.createMailConfirmation(userWithoutValidConfirmation, { expires_at: moment().subtract(1, 'day').toDate() });

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
});
