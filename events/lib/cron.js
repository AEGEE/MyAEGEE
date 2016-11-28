var schedule = require('node-schedule');
var Event = require('./eventModel.js');
var mongoose = require('./config/mongo.js');
var log = require('./config/logger.js');

var scheduledJobs = 0;

var closeDeadline = function (id, plannedTime) {
  scheduledJobs = scheduledJobs - 1;
  Event.findById(id).exec(function (err, event) {
    if (err) {
      log.error('Could not close deadline for event ' + id, err);
      return;
    }

    // Check if wrong id,
    // deadline had changed since we started the cron
    // or the application was closed already
    if (!event ||
     event.application_deadline.getTime() != plannedTime.getTime() ||
     event.application_status == 'closed') {
      return;
    }

    // Change application status to closed
    event.application_status = 'closed';
    event.save(function (err) {
      if (err)
       log.error('Could not save event after auto-closing application');
      else
       log.info('Automatically closed application of event ' + event.name);
    });
  });
};

exports.countJobs = function () {
  return scheduledJobs;
};

exports.registerDeadline = function (id, plannedTime) {
  schedule.scheduleJob(plannedTime, closeDeadline.bind(null, id, plannedTime));
  scheduledJobs = scheduledJobs + 1;
};

exports.scanDB = function (done) {
  var counter = 0;
  Event
   .where('application_status', 'open')
   .exec(function (err, events) {
    events.forEach(item => {
      if (item.application_deadline) {

        // Close past events immediately - could happen if service was down while deadline passed
        if (item.application_deadline < Date.now()) {
          closeDeadline(item.id, item.application_deadline);
          counter++;
        }

        // Otherwise schedule it
        else {
          exports.registerDeadline(item.id, item.application_deadline);
          counter++;
        }
      }
    });

    log.info('Set up cron timers for ' + counter + ' events with approaching deadlines');

    if (done)
     done();
  });
};
