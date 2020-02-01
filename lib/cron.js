const cron = require('node-cron');

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

        logger.info('Found %d stale mail confirmations', confirmations.length);
        for (const confirmation of confirmations) {
            const { user } = confirmation;
            logger.info(
                'Deleting not confirmed user %s: id %d with email %s',
                user.username,
                user.id,
                user.email
            );

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
        logger.info(`Added a job: "${description}" with id ${id}, \
with rule ${rule}, \
with the following params: %o`, params);
        return id;
    }

    async executeJob(id) {
        const job = this.jobs[id];
        if (!job) {
            logger.warn(`Job with ID #${id} is not found.`);
            return;
        }

        logger.info(`Executing job #${job.id}: "${job.description}", with rule ${job.rule}.`);
        await job.callback(job.params);
        logger.info(`Executed job #${job.id}: "${job.description}", with rule ${job.rule}.`);
    }

    // eslint-disable-next-line class-methods-use-this
    async registerAllTasks() {
        this.addJob(this.JOB_TYPES.DELETE_NOT_CONFIRMED_USERS);
    }
}

const manager = new JobManager();
module.exports = manager;
