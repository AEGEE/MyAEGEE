const scheduler = require('node-schedule');
const moment = require('moment');

const logger = require('./logger');
const { Position, Candidate, Plenary } = require('../models');

let jobs = [];

exports.getJobs = () => jobs;

exports.clearDeadlinesForId = (id) => {
    for (let index = jobs.length - 1; index >= 0; index--) {
        const job = jobs[index];
        if (job.objectId === id) {
            scheduler.cancelJob(job.jobId);
            jobs.splice(index, 1);
        }
    }
};

exports.clearAll = () => {
    for (const job of jobs) {
        scheduler.cancelJob(job.jobId);
    }
    jobs = [];
};

exports.registerAllDeadlines = async () => {
    const positions = await Position.findAll({});
    logger.info(`Registering deadline for ${positions.length} positions...`);
    for (const position of positions) {
        // Re-saving the application to update status.
        await position.update({ id: position.id }); // so there'd be at least 1 field

        // Registering deadlines.
        exports.registerOpenApplicationDeadline(position.starts, position.id);
        exports.registerCloseApplicationDeadline(position.ends, position.id);
    }

    const plenaries = await Plenary.findAll({});
    logger.info(`Registering deadline for ${plenaries.length} plenaries...`);
    for (const plenary of plenaries) {
        if (moment().isAfter(plenary.ends)) {
            await plenary.closeAttendances();
        } else {
            // Registering deadlines.
            exports.registerCloseAttendancesDeadline(plenary.ends, plenary.id);
        }
    }
};

exports.registerCloseAttendancesDeadline = (time, id) => {
    if (moment().isAfter(time)) {
        logger.warn(`Trying to close plenary attendances at ${time}, which is in the past. Skipping...`);
        return;
    }

    const jobId = scheduler.scheduleJob(time, () => exports.closeAttendances(id));
    jobs.push({
        type: 'plenary',
        action: 'close',
        id: jobId,
        objectId: id,
        time
    });
    logger.info(`Successfully registered closing attendances deadline for plenary #${id} as ${time}`);
};

exports.registerOpenApplicationDeadline = (time, id) => {
    if (moment().isAfter(time)) {
        logger.warn(`Trying to set open deadline to ${time}, which is in the past. Skipping...`);
        return;
    }

    const jobId = scheduler.scheduleJob(time, () => exports.openApplications(id));
    jobs.push({
        type: 'position',
        action: 'open',
        id: jobId,
        objectId: id,
        time
    });
    logger.info(`Successfully registered opening deadline for position #${id} as ${time}`);
};

exports.registerCloseApplicationDeadline = (time, id) => {
    if (moment().isAfter(time)) {
        logger.warn(`Trying to set close deadline to ${time}, which is in the past. Skipping...`);
        return;
    }

    const jobId = scheduler.scheduleJob(time, () => exports.closeApplications(id));
    jobs.push({
        type: 'position',
        action: 'close',
        id: jobId,
        objectId: id,
        time
    });
    logger.info(`Successfully registered closing deadline for position #${id} as ${time}`);
};

exports.openApplications = async (id) => {
    const position = await Position.findByPk(id);
    if (!position) {
        logger.warn(`Opening applications for position ${id}: Position is not found.`);
        jobs = jobs.filter(job => !(job.type === 'position' && job.action === 'open' && job.objectId === id));
        return;
    }

    if (position.status !== 'closed') {
        logger.warn(`Opening applications for position ${id}: Position status is not closed.`);
        jobs = jobs.filter(job => !(job.type === 'position' && job.action === 'open' && job.objectId === id));
        return;
    }

    await position.update({ status: 'open' });
    logger.info(`Opening applications for position ${id}: Successfully opened deadline for position #${id} (${position.name})`);

    jobs = jobs.filter(job => !(job.type === 'position' && job.action === 'open' && job.objectId === id));
};

exports.closeApplications = async (id) => {
    const position = await Position.findByPk(id, {
        include: [Candidate]
    });

    if (!position) {
        logger.warn(`Closing applications for position ${id}: Position is not found.`);
        jobs = jobs.filter(job => !(job.type === 'position' && job.action === 'close' && job.objectId === id));
        return;
    }

    if (position.status === 'closed') {
        logger.warn(`Closing applications for position ${id}: Position status is not open.`);
        jobs = jobs.filter(job => !(job.type === 'position' && job.action === 'close' && job.objectId === id));
        return;
    }

    // Checking if there's enough candides, otherwise not closing the deadline.
    const candidates = position.candidates
        .filter(candidate => candidate.status !== 'rejected')
        .length;

    if (candidates <= position.places) {
        logger.warn(`Closing applications for position ${id}: not filled all the places (required ${position.places}, applied ${candidates})`);
        jobs = jobs.filter(job => !(job.type === 'position' && job.action === 'close' && job.objectId === id));
        return;
    }

    await position.update({ status: 'closed' }, { hooks: false });
    logger.info(`Closing applications for position ${id}: Successfully closed deadline for position #${id} (${position.name})`);

    jobs = jobs.filter(job => !(job.type === 'position' && job.action === 'close' && job.objectId === id));
};

exports.closeAttendances = async (id) => {
    const plenary = await Plenary.findByPk(id);

    if (!plenary) {
        logger.warn(`Closing attendances for plenary ${id}: Plenary is not found.`);
        jobs = jobs.filter(job => !(job.type === 'plenary' && job.action === 'close' && job.objectId === id));
        return;
    }

    await plenary.closeAttendances();
    logger.info(`Closing attendances for plenary ${id}: Successfully closed attendances for plenary #${id} (${plenary.name})`);

    jobs = jobs.filter(job => !(job.type === 'plenary' && job.action === 'close' && job.objectId === id));
};
