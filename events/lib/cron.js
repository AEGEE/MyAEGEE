const schedule = require('node-schedule');
const Event = require('./models/Event');
const log = require('./config/logger.js');

let scheduledJobs = 0;

const closeDeadline = async (id, plannedTime) => {
  scheduledJobs--;
  try {
    const event = await Event.findById(id);

    // Check if wrong id,
    // deadline had changed since we started the cron
    // or the application was closed already
    if (!event) {
      log.warn('Can\'t close the deadline: event not found.');
      return;
    }

    if (event.application_deadline.getTime() !== plannedTime.getTime()) {
      log.warn('Didn\'t close the deadline: planned and actual time mismatch.');
      return;
    }

    if (event.application_status === 'closed') {
      log.warn('Didn\'t close the deadline: already closed.');
      return;
    }

    // Change application status to closed
    event.application_status = 'closed';
    await event.save();
    log.info(`Automatically closed application of event ${event.name}`);
  } catch (err) {
    log.error('Could not close deadline for event', err.message);
  }
};

exports.countJobs = () => scheduledJobs;

exports.registerDeadline = (id, plannedTime) => {
  schedule.scheduleJob(plannedTime, closeDeadline.bind(null, id, plannedTime));
  scheduledJobs++;
};

exports.scanDB = async () => {
  let counter = 0;
  const events = await Event.where('application_status', 'open');

  for (const item of events) {
    if (item.application_deadline) {
      // Close past events immediately - could happen if service was down while deadline passed
      if (item.application_deadline < Date.now()) {
        await closeDeadline(item.id, item.application_deadline);
        counter++;
      } else { // Otherwise schedule it
        exports.registerDeadline(item.id, item.application_deadline);
        counter++;
      }
    }
  }

  log.info(`Set up cron timers for ${counter} events with approaching deadlines`);
};
