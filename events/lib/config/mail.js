

var config = require('./config.json');
var log = require('./logger');

// Creates a SMTP client
var email = require('emailjs');
var mailserver  = email.server.connect({
   user:     config.gmail.user, 
   password: config.gmail.password, 
   host:    "smtp.gmail.com", 
   port: 587,
   tls: {ciphers: "SSLv3"}
});

//v0.1.0
exports.sendMail = function(message){
  console.log("message to be sent");

  message.from = "AEGEE-do-not-reply <"+config.gmail.address+">"

  // send the message and get a callback with an error or details of the message that was sent
  //mailserver.send(message, function(err, message) { 
  //  console.log(err || message); 
  //  log.info({message: message, err: err}, 'Email sent');
  //});

  console.log(message);
}

