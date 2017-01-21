const schedule = require('node-schedule');
const Event = require('./models/Event');
const log = require('./config/logger.js');

let scheduledJobs = 0;

const closeDeadline = (id, plannedTime) => {
  scheduledJobs--;
  Event.findById(id).exec((err, event) => {
    if (err) {
      log.error(`Could not close deadline for event ${id}`, err);
      return;
    }

    // Check if wrong id,
    // deadline had changed since we started the cron
    // or the application was closed already
    if (!event ||
     event.application_deadline.getTime() !== plannedTime.getTime() ||
     event.application_status === 'closed') {
      return;
    }

    // Change application status to closed
    event.application_status = 'closed';
    event.save((saveErr) => {
      if (saveErr) {
        log.error('Could not save event after auto-closing application', saveErr);
      } else {
        log.info(`Automatically closed application of event ${event.name}`);
      }
    });
  });
};

exports.countJobs = () => scheduledJobs;

exports.registerDeadline = (id, plannedTime) => {
  schedule.scheduleJob(plannedTime, closeDeadline.bind(null, id, plannedTime));
  scheduledJobs++;
};

exports.scanDB = (done) => {
  let counter = 0;
  Event
    .where('application_status', 'open')
    .exec((err, events) => {
      events.forEach((item) => {
        if (item.application_deadline) {
        // Close past events immediately - could happen if service was down while deadline passed
          if (item.application_deadline < Date.now()) {
            closeDeadline(item.id, item.application_deadline);
            counter++;
          } else { // Otherwise schedule it
            exports.registerDeadline(item.id, item.application_deadline);
            counter++;
          }
        }
      });

      log.info(`Set up cron timers for ${counter} events with approaching deadlines`);

      if (done) {
        done();
      }
    });
};
