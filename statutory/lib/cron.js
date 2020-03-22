const scheduler = require('node-schedule');
const moment = require('moment');

const logger = require('./logger');
const { Position, Candidate, Plenary } = require('../models');

const JobCallbacks = {
    CLOSE_ATTENDANCES: async ({ id }) => {
        const plenary = await Plenary.findByPk(id);

        if (!plenary) {
            logger.warn({ id }, 'Closing attendances for plenary: Plenary is not found.');
            return;
        }

        await plenary.closeAttendances();
        logger.info({ plenary }, 'Closing attendances for plenary: Successfully closed attendances for plenary');
    },
    OPEN_POSITION_APPLICATIONS: async ({ id }) => {
        const position = await Position.findByPk(id);
        if (!position) {
            logger.warn({ id }, 'Opening applications for position: Position is not found.');
            return;
        }

        if (position.status !== 'closed') {
            logger.warn({ position }, 'Opening applications for position: Position status is not closed.');
            return;
        }

        await position.update({ status: 'open' }, { hooks: false });
        logger.info({ position }, 'Opening applications for position: Successfully opened deadline for position');
    },
    CLOSE_POSITION_APPLICATIONS: async ({ id, force = false }) => {
        const position = await Position.findByPk(id, {
            include: [Candidate]
        });

        if (!position) {
            logger.warn({ id }, 'Closing applications for position: Position is not found.');
            return;
        }

        if (position.status === 'closed') {
            logger.warn({ position }, 'Closing applications for position: Position status is not open.');
            return;
        }

        // Checking if there's enough candides, otherwise not closing the deadline.
        const candidates = position.candidates
            .filter(candidate => candidate.status !== 'rejected')
            .length;

        if (candidates <= position.places && !force) {
            logger.warn({
                position,
                places: position.places,
                candidates,
            }, 'Closing applications for position: not filled all the places');
            return;
        }

        await position.update({ status: 'closed' }, { hooks: false });
        logger.info({ position }, 'Closing applications for position: Successfully closed deadline for position');
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
            logger.warn({
                description,
                scheduled_on: moment(time).format('YYYY-MM-DD HH:mm:SS'),
                params
            }, 'Job is not added: is in the past, not scheduling.');
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
        logger.info({
            id,
            description,
            scheduled_on: moment(time).format('YYYY-MM-DD HH:mm:SS'),
            params
        }, 'Added a job');
        return id;
    }

    async executeJob(id) {
        const job = this.jobs[id];
        if (!job) {
            logger.warn({ id }, 'Job is not found.');
            return;
        }

        logger.info({ job }, 'Executing job');
        await job.callback(job.params);
        logger.info({ job }, 'Executed job');
        delete this.jobs[id];
    }

    cancelJob(id) {
        const job = this.jobs[id];
        if (!job) {
            logger.warn({ id }, 'Job is not found.');
            return;
        }

        logger.info({ job }, 'Cancelling job');
        scheduler.cancelJob(job.job);
        delete this.jobs[id];
    }

    // eslint-disable-next-line class-methods-use-this
    async registerAllDeadlines() {
        const positions = await Position.findAll({});
        logger.info({ count: positions.length }, 'Registering deadline for positions...');
        for (const position of positions) {
            // Triggering model update to run hooks to set deadlines.
            position.changed('id', true);
            await position.save();
        }

        const plenaries = await Plenary.findAll({});
        logger.info({ count: plenaries.length }, 'Registering deadline for plenaries...');
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
