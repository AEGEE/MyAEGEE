const scheduler = require('node-schedule');
const moment = require('moment');

const logger = require('./logger');
const { Position, Candidate, Plenary } = require('../models');

const JobCallbacks = {
    CLOSE_ATTENDANCES: async ({ id }) => {
        const plenary = await Plenary.findByPk(id);

        if (!plenary) {
            logger.warn(`Closing attendances for plenary ${id}: Plenary is not found.`);
            return;
        }

        await plenary.closeAttendances();
        logger.info(`Closing attendances for plenary ${id}: Successfully closed attendances for plenary #${id} (${plenary.name})`);
    },
    OPEN_POSITION_APPLICATIONS: async ({ id }) => {
        const position = await Position.findByPk(id);
        if (!position) {
            logger.warn(`Opening applications for position ${id}: Position is not found.`);
            return;
        }

        if (position.status !== 'closed') {
            logger.warn(`Opening applications for position ${id}: Position status is not closed.`);
            return;
        }

        await position.update({ status: 'open' }, { hooks: false });
        logger.info(`Opening applications for position ${id}: Successfully opened deadline for position #${id} (${position.name})`);
    },
    CLOSE_POSITION_APPLICATIONS: async ({ id, force = false }) => {
        const position = await Position.findByPk(id, {
            include: [Candidate]
        });

        if (!position) {
            logger.warn(`Closing applications for position ${id}: Position is not found.`);
            return;
        }

        if (position.status === 'closed') {
            logger.warn(`Closing applications for position ${id}: Position status is not open.`);
            return;
        }

        // Checking if there's enough candides, otherwise not closing the deadline.
        const candidates = position.candidates
            .filter(candidate => candidate.status !== 'rejected')
            .length;

        if (candidates <= position.places && !force) {
            logger.warn(`Closing applications for position ${id}: not filled all the places (required ${position.places}, applied ${candidates})`);
            return;
        }

        await position.update({ status: 'closed' }, { hooks: false });
        logger.info(`Closing applications for position ${id}: Successfully closed deadline for position #${id} (${position.name})`);
    }
};

class JobManager {
    constructor() {
        this.jobs = {};
        this.currentJob = 0;

        this.JOB_TYPES = {
            CLOSE_ATTENDANCES: {
                key: 'CLOSE_ATTENDANCES',
                description: 'Closing plenary attendance',
                callback: JobCallbacks.CLOSE_ATTENDANCES
            },
            OPEN_POSITION_APPLICATIONS: {
                key: 'OPEN_POSITION_APPLICATIONS',
                description: 'Open position application deadline',
                callback: JobCallbacks.OPEN_POSITION_APPLICATIONS
            },
            CLOSE_POSITION_APPLICATIONS: {
                key: 'CLOSE_POSITION_APPLICATIONS',
                description: 'Close position application deadline',
                callback: JobCallbacks.CLOSE_POSITION_APPLICATIONS
            }
        };
    }

    addJob(jobType, time, params) {
        const {
            description,
            callback,
            key
        } = jobType;

        if (moment().isAfter(time)) {
            logger.warn(`Job "${description}" with params %o is not added: \
is in the past (${moment(time).format('YYYY-MM-DD HH:mm:SS')}), not scheduling.`, params);
            return;
        }

        const id = ++this.currentJob;

        const job = scheduler.scheduleJob(time, () => this.executeJob(id));

        this.jobs[id] = {
            key,
            description,
            time,
            params,
            id,
            callback,
            job
        };
        logger.info(`Added a job: "${description}" with id ${id}, \
scheduled on ${moment(time).format('YYYY-MM-DD HH:mm:SS')}, \
with the following params: %o`, params);
        return id;
    }

    async executeJob(id) {
        const job = this.jobs[id];
        if (!job) {
            logger.warn(`Job with ID #${id} is not found.`);
            return;
        }

        logger.info(`Executing job #${job.id}: "${job.description}", scheduled on ${moment(job.time).format('YYYY-MM-DD HH:mm:SS')}.`);
        await job.callback(job.params);
        logger.info(`Executed job #${job.id}: "${job.description}", scheduled on ${moment(job.time).format('YYYY-MM-DD HH:mm:SS')}.`);
        delete this.jobs[id];
    }

    cancelJob(id) {
        const job = this.jobs[id];
        if (!job) {
            logger.warn(`Job with ID #${id} is not found.`);
            return;
        }

        logger.info(`Cancelling job #${job.id}: "${job.description}", scheduled on ${moment(job.time).format('YYYY-MM-DD HH:mm:SS')}.`);
        scheduler.cancelJob(job.job);
        delete this.jobs[id];
    }

    // eslint-disable-next-line class-methods-use-this
    async registerAllDeadlines() {
        const positions = await Position.findAll({});
        logger.info(`Registering deadline for ${positions.length} positions...`);
        for (const position of positions) {
            // Triggering model update to run hooks to set deadlines.
            position.changed('id', true);
            await position.save();
        }

        const plenaries = await Plenary.findAll({});
        logger.info(`Registering deadline for ${plenaries.length} plenaries...`);
        for (const plenary of plenaries) {
            if (moment().isAfter(plenary.ends)) {
                await plenary.closeAttendances();
            } else {
                // Triggering model update to run hooks to set deadlines.
                plenary.changed('id', true);
                await plenary.save();
            }
        }
    }

    clearJobs(key, params) {
        const ids = Object.keys(this.jobs);
        for (const id of ids) {
            const job = this.jobs[id];

            if (job.key !== key.key) {
                continue;
            }

            if (params.id !== job.params.id) {
                continue;
            }

            this.cancelJob(id);
        }
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
