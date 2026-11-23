const cron = require('node-cron');
const _ = require('lodash');
const moment = require('moment');

const logger = require('./logger');
const config = require('../config');
const {
    MailChange,
    MailConfirmation,
    RefreshToken,
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
            logger.info({ user_id: user.id }, 'Deleting not confirmed user');

            await confirmation.destroy();
            await user.destroy();

            logger.info('Deleted.');
        }

        logger.info('All confirmations and users are deleted.');
    },
    DELETE_ROTATED_REFRESH_TOKENS: async () => {
        const graceStart = moment().subtract(config.ttl.refresh_token_grace_period, 'seconds').toDate();
        const deleted = await RefreshToken.destroy({
            where: {
                rotated_at: { [Sequelize.Op.lt]: graceStart }
            }
        });

        logger.info({ deleted }, 'Deleted rotated refresh tokens');
    },
    // An email change that was not confirmed in time can't be confirmed anymore, and nothing else removes it.
    DELETE_EXPIRED_MAIL_CHANGES: async () => {
        const deleted = await MailChange.destroy({
            where: {
                expires_at: { [Sequelize.Op.lt]: new Date() }
            }
        });

        logger.info({ deleted }, 'Deleted expired email changes');
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
            },
            DELETE_ROTATED_REFRESH_TOKENS: {
                key: 'DELETE_ROTATED_REFRESH_TOKENS',
                description: 'Deleting rotated refresh tokens after their grace period.',
                rule: '0 * * * *',
                callback: JobCallbacks.DELETE_ROTATED_REFRESH_TOKENS
            },
            DELETE_EXPIRED_MAIL_CHANGES: {
                key: 'DELETE_EXPIRED_MAIL_CHANGES',
                description: 'Deleting email changes that were not confirmed in time.',
                rule: '30 * * * *',
                callback: JobCallbacks.DELETE_EXPIRED_MAIL_CHANGES
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
        this.addJob(this.JOB_TYPES.DELETE_ROTATED_REFRESH_TOKENS);
        this.addJob(this.JOB_TYPES.DELETE_EXPIRED_MAIL_CHANGES);
    }

    cancelJob(id) {
        const job = this.jobs[id];
        if (!job) {
            logger.warn({ id }, 'Cancelling job: Job with ID is not found.');
            return;
        }

        logger.info({ job: _.pick(job, ['id', 'description', 'rule']) }, 'Cancelling job');
        job.job.destroy();
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
