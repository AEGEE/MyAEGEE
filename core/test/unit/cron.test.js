const nodeCron = require('node-cron');

const cron = require('../../lib/cron');

describe('Cron jobs', () => {
    let schedule;

    beforeEach(() => {
        // Nothing is really scheduled: the test runs what would be, by hand.
        schedule = jest.spyOn(nodeCron, 'schedule').mockImplementation(() => ({ destroy: jest.fn() }));
    });

    afterEach(() => {
        cron.clearAll();
        jest.restoreAllMocks();
    });

    describe('addJob', () => {
        test('should schedule the job by its rule', () => {
            const id = cron.addJob({ key: 'TEST', description: 'A test job.', rule: '*/5 * * * *', callback: jest.fn() });

            expect(schedule).toHaveBeenCalledTimes(1);
            expect(schedule).toHaveBeenCalledWith('*/5 * * * *', expect.any(Function));
            expect(cron.jobs[id]).toEqual({
                id,
                key: 'TEST',
                description: 'A test job.',
                rule: '*/5 * * * *',
                params: {},
                callback: expect.any(Function),
                job: schedule.mock.results[0].value
            });
        });

        test('should run the job with its parameters when its time has come', async () => {
            const callback = jest.fn();
            cron.addJob({ key: 'TEST', description: 'A test job.', rule: '0 * * * *', callback }, { days: 7 });
            const [, scheduled] = schedule.mock.calls[0];
            expect(callback).not.toHaveBeenCalled();

            await scheduled();

            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith({ days: 7 });
        });

        test('should run each job on its own', async () => {
            const first = jest.fn();
            const second = jest.fn();
            cron.addJob({ key: 'FIRST', description: 'The first job.', rule: '0 * * * *', callback: first });
            cron.addJob({ key: 'SECOND', description: 'The second job.', rule: '30 * * * *', callback: second });

            await schedule.mock.calls[1][1]();

            expect(first).not.toHaveBeenCalled();
            expect(second).toHaveBeenCalledTimes(1);
        });

        test('should not run a job that was cancelled in the meantime', async () => {
            const callback = jest.fn();
            const id = cron.addJob({ key: 'TEST', description: 'A test job.', rule: '0 * * * *', callback });
            const { job } = cron.jobs[id];
            cron.cancelJob(id);

            await schedule.mock.calls[0][1]();

            expect(job.destroy).toHaveBeenCalledTimes(1);
            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe('registerAllTasks', () => {
        test('should schedule every job of the service', async () => {
            await cron.registerAllTasks();

            expect(schedule.mock.calls.map(([rule]) => rule)).toEqual(['*/10 * * * *', '0 * * * *', '30 * * * *']);
            expect(Object.values(cron.jobs).map((job) => job.key)).toEqual([
                'DELETE_NOT_CONFIRMED_USERS',
                'DELETE_ROTATED_REFRESH_TOKENS',
                'DELETE_EXPIRED_MAIL_CHANGES'
            ]);
        });
    });
});
