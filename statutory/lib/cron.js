const scheduler = require('node-schedule');
const moment = require('moment');

const logger = require('./logger');
const { Position } = require('../models');

let jobs = [];

exports.getJobs = () => jobs;

exports.clearDeadlinesForPosition = (id) => {
    for (const job of jobs) {
        if (job.objectId === id) {
            scheduler.cancelJob(job.jobId);
        }
    }

    jobs = jobs.filter(job => job.objectId !== id);
}

exports.clearAll = (id) => {
    for (const job of jobs) {
        scheduler.cancelJob(job.jobId);
    }
    jobs = [];
}

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
}

exports.registerCloseApplicationDeadline = (time, id) => {
    if (moment().isAfter(time)) {
        logger.warn(`Trying to set close deadline to ${time}, which is in the past. Time ${time} Skipping...`);
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
}

exports.openApplications = async (id) => {
    const position = await Position.findByPk(id);
    if (!position) {
        logger.warn('Position is not found.');
        jobs = jobs.filter(job => !(job.type === 'position' && job.action === 'open' && job.objectId === id));
        return;
    }

    if (position.status !== 'closed') {
        logger.warn('Position status is not closed.');
        jobs = jobs.filter(job => !(job.type === 'position' && job.action === 'open' && job.objectId === id));
        return;
    }

    await position.update({ status: 'open' });
    logger.info(`Successfully opened deadline for position #${id} (${position.name})`);

    jobs = jobs.filter(job => !(job.type === 'position' && job.action === 'open' && job.objectId === id));
}

exports.closeApplications = async (id) => {
    const position = await Position.findByPk(id, {
        // to include candidates here
    });

    if (!position) {
        logger.warn('Position is not found.');
        jobs = jobs.filter(job => !(job.type === 'position' && job.action === 'close' && job.objectId === id));
        return;
    }

    if (position.status === 'closed') {
        logger.warn('Position status is not open.');
        jobs = jobs.filter(job => !(job.type === 'position' && job.action === 'close' && job.objectId === id));
        return;
    }

    // TODO: check if enough candidates, not update otherwise.

    await position.update({ status: 'closed' });
    logger.info(`Successfully closed deadline for position #${id} (${position.name})`);

    jobs = jobs.filter(job => !(job.type === 'position' && job.action === 'close' && job.objectId === id));
}
