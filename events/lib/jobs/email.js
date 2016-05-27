//#WIP for the scheduling of emails
//following the example at https://github.com/rschmukler/agenda
var config = require('../config/config.json');

// Creates a SMTP client
var email = require('emailjs');
var mailserver  = email.server.connect({
   user:     config.gmail.user, 
   password: config.gmail.password, 
   host:    "smtp.gmail.com", 
   port: 587,
   tls: {ciphers: "SSLv3"}
});

module.exports = function(agenda) {
  agenda.define('registration email', function(job, done) {
    User.get(job.attrs.data.userId, function(err, user) {
       if(err) return done(err);
       email(user.email(), 'Thanks for registering', 'Thanks for registering ' + user.name(), done);
     });
  });

  agenda.define('reset password', function(job, done) {
    // etc etc
  })

  // More email related jobs
}