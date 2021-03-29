const cron = require('node-cron');
const _ = require('lodash');

const logger = require('./logger');
const {
    MailConfirmation,
    User,
} = require('../models');
const { Sequelize } = require('./sequelize');

const JobCallbacks = {
    DELETE_NOT_CONFIRMED_USERS: async () => {
        const confirmations = await MailConfirmation.findAll({
            where: {
                expires_at: { [Sequelize.Op.lt]: new Date() }
            },
            include: [User]
        });

        logger.info({ length: confirmations.length }, 'Found stale mail confirmations');
        for (const confirmation of confirmations) {
            const { user } = confirmation;
            logger.info({
                user: _.pick(user, ['username', 'id', 'email'])
            }, 'Deleting not confirmed user');

            await confirmation.destroy();
            await user.destroy();

            logger.info('Deleted.');
        }

        logger.info('All confirmations and users are deleted.');
    }
};

class JobManager {
    constructor() {
        this.jobs = {};
        this.currentJob = 0;

        this.JOB_TYPES = {
            DELETE_NOT_CONFIRMED_USERS: {
                key: 'DELETE_NOT_CONFIRMED_USERS',
                description: 'Deleting mail confirmations and their users.',
                rule: '*/10 * * * *',
                callback: JobCallbacks.DELETE_NOT_CONFIRMED_USERS
            }
        };
    }

    addJob(jobType, params = {}) {
        const {
            description,
            callback,
            key,
            rule,
        } = jobType;

        const id = ++this.currentJob;

        /* istanbul ignore next */
        const job = cron.schedule(rule, () => this.executeJob(id));

        this.jobs[id] = {
            key,
            description,
            rule,
            params,
            id,
            callback,
            job
        };
        logger.info({
            description,
            id,
            rule,
            params,
        }, 'Added a job');
        return id;
    }

    async executeJob(id) {
        const job = this.jobs[id];
        if (!job) {
            logger.warn({ id }, 'Executing job: job with ID is not found.');
            return;
        }

        logger.info({ job: _.pick(job, ['id', 'description', 'rule']) }, 'Executing job');
        await job.callback(job.params);
        logger.info({ job: _.pick(job, ['id', 'description', 'rule']) }, 'Executed job');
    }

    // eslint-disable-next-line class-methods-use-this
    async registerAllTasks() {
        this.addJob(this.JOB_TYPES.DELETE_NOT_CONFIRMED_USERS);
    }

    // for tests only
    /* istanbul ignore next */
    cancelJob(id) {
        const job = this.jobs[id];
        if (!job) {
            logger.warn({ id }, 'Cancelling job: Job with ID is not found.');
            return;
        }

        logger.info({ job: _.pick(job, ['id', 'description', 'rule']) }, 'Cancelling job');
        delete this.jobs[id];
    }

    clearAll() {
        const ids = Object.keys(this.jobs);
        for (const id of ids) {
            this.cancelJob(id);
        }
    }
}

const manager = new JobManager();
module.exports = manager;
