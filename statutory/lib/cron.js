const scheduler = require('node-schedule');
const moment = require('moment');

const logger = require('./logger');
const helpers = require('./helpers');
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
    OPEN_POSITION_APPLICATIONS: async ({ id } ) => {
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
    CLOSE_POSITION_APPLICATIONS: async ({ id }) => {
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

        if (candidates <= position.places) {
            logger.warn(`Closing applications for position ${id}: not filled all the places (required ${position.places}, applied ${candidates})`);
            return;
        }

        await position.update({ status: 'closed' }, { hooks: false });
        logger.info(`Closing applications for position ${id}: Successfully closed deadline for position #${id} (${position.name})`);
    }
};

class JobManager {
    constructor() {
        this.jobs = [];
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
        }
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

        const job = scheduler.scheduleJob(time, async () => await this.executeJob(id));

        this.jobs.push({
            key,
            description,
            time,
            params,
            id,
            callback,
            job
        });
        logger.info(`Added a job: "${description}", \
scheduled on ${moment(time).format('YYYY-MM-DD HH:mm:SS')}, \
with the following params: %o`, params);
    }

    async executeJob(id) {
        const jobIndex = this.jobs.findIndex(j => j.id === id);
        if (jobIndex === -1) {
            logger.warn(`Job with ID #${id} is not found.`);
            return;
        }

        const job = this.jobs[jobIndex];

        logger.info(`Executing job #${job.id}: "${job.description}", scheduled on ${moment(job.time).format('YYYY-MM-DD HH:mm:SS')}.`);
        await job.callback(job.params);
        logger.info(`Executed job #${job.id}: "${job.description}", scheduled on ${moment(job.time).format('YYYY-MM-DD HH:mm:SS')}.`);
        this.jobs.splice(jobIndex, 1);
    }

    cancelJobByIndex(index) {
        const job = this.jobs[index];

        if (!job) {
            logger.warn(`Job with index #${index} is not found.`);
            return;
        }

        logger.info(`Cancelling job #${job.id}: "${job.description}", scheduled on ${moment(job.time).format('YYYY-MM-DD HH:mm:SS')}.`);
        scheduler.cancelJob(job.job);
        this.jobs.splice(index, 1);
    }

    async registerAllDeadlines () {
        const positions = await Position.findAll({});
        logger.info(`Registering deadline for ${positions.length} positions...`);
        for (const position of positions) {
            // Re-saving the application to update status.
            await position.update({ id: position.id }); // so there'd be at least 1 field

            // Registering deadlines.
            this.addJob(this.JOB_TYPES.OPEN_POSITION_APPLICATIONS, position.starts, { id: position.id });
            this.addJob(this.JOB_TYPES.CLOSE_POSITION_APPLICATIONS, position.ends, { id: position.id });
        }

        const plenaries = await Plenary.findAll({});
        logger.info(`Registering deadline for ${plenaries.length} plenaries...`);
        for (const plenary of plenaries) {
            if (moment().isAfter(plenary.ends)) {
                await plenary.closeAttendances();
            } else {
                // Registering deadlines.
                this.addJob(this.JOB_TYPES.CLOSE_ATTENDANCES, plenary.ends, { id: plenary.id });
            }
        }
    };

    clearJobs(key, params) {
        for (let index = this.jobs.length - 1; index >= 0; index--) {
            const job = this.jobs[index];

            if (job.key !== key.key) {
                continue;
            }

            if (!helpers.deepEqual(params, job.params)) {
                continue;
            }

            this.cancelJobByIndex(index);
        }
    }

    clearAll() {
        for (let index = this.jobs.length - 1; index >= 0; index--) {
            this.cancelJobByIndex(index);
        }
    }
}

const manager = new JobManager();
module.exports = manager;
