//this file sets the timers, the functions triggered are 
//defined in another file


var config = require('../config/config.json');

var Agenda = require('agenda');
var agenda = new Agenda({db: {address: config.mongo.url}});

require('./memberships.js')(agenda)

agenda.on('ready', function() {

  //first thing purge old stuff (just for development!)
  agenda.purge(function(err, numRemoved) {console.log("Undefined jobs removed: "+ numRemoved)}); 

  // Every day at 2.30am check for membership expiration
  //agenda.every('30 2 * * *', 'Check membership expiration');

  //TO CHECK IT: every 4 min
  agenda.every('*/4 * * * *', 'Check membership expiration');

  // Every 9th day of month at 3.30am take a "snapshot" of the members list for every local
  //agenda.every('30 3 9 * *', 'Snapshot members list');

  // Every 8th day of month at 3.30am check for membership deletion
  //agenda.every('30 3 8 * *', 'Check membership for deletion');

  agenda.on('start', function(job) {
    console.log("Job %s starting", job.attrs.name);
  });

  agenda.on('complete', function(job) {
    console.log("Job %s finished", job.attrs.name);
  });
  agenda.on('success', function(job) {
    console.log("Job %s executed successfully", job.attrs.name);
  });
  agenda.on('fail', function(err, job) {
    console.log("Job %s failed with error: %s", job.attrs.name, err.message);
  });

  agenda.start();
});

function graceful() {
  console.log("attempting graceful shutdown of agenda");
  agenda.stop(function() {
    process.exit(0);
  });
}

process.on('SIGTERM', graceful);
process.on('SIGINT' , graceful);


//module.exports = agenda;
