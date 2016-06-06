
var restify = require('restify');
var events = require('./events'); //the real place where the API callbacks are
var log = require('./config/logger');

var config = require('./config/config.json');

var server = restify.createServer({
    name: 'oms-events',
    log: log
});

server.use(restify.queryParser());
server.use(restify.bodyParser());
server.use(restify.CORS());



//Define your API here

//this endpoint is for public access
//server.post({path: '/authenticate', version: '0.0.6'} , core.authenticate );

//for endpoints declared from here onwards, apply the middleware "verifyToken"
//server.use(core.verifyToken);

// Enable request logging
server.pre(function (request, response, next) {
  request.log.info({req: request}, 'start'); 
  return next();
});
server.on('after', function (req, res, route) {
  req.log.info({res: res}, "finished");
});

var cur_version = '0.0.1';

server.use(events.countRequests);

server.get({path: '/', version: cur_version}, events.listEvents );
server.post({path: '/', version: cur_version}, events.addEvent );

server.get({path: '/single/:event_id', version: cur_version}, events.eventDetails );
server.put({path: '/single/:event_id', version: cur_version}, events.editEvent );
server.del({path: '/single/:event_id', version: cur_version}, events.deleteEvent );

server.get({path: '/single/:event_id/participants', version: cur_version}, events.listParticipants );
server.post({path: '/single/:event_id/participants', version: cur_version}, events.applyParticipant );
server.get({path: '/single/:event_id/participants/:user_id', version: cur_version}, events.getApplication );
server.put({path: '/single/:event_id/participants/:user_id', version: cur_version}, events.setApplication );

server.get({path: '/single/:event_id/organizers', version: cur_version}, events.listOrganizers );
server.post({path: '/single/:event_id/organizers', version: cur_version}, events.addOrganizer );
server.del({path: '/single/:event_id/organizers/:user_id', version: cur_version}, events.delOrganizer );

//server.get({path: '/single/:event_id/locals', version: cur_version}, events.listOrganizingLocals ); // optional
//server.put({path: '/single/:event_id/locals', version: cur_version}, events.setOrganizingLocals ); // optional

//server.get({path: '/single/:event_id/applicationfields', version: cur_version}, events.listApplicationFields ); // optional
//server.put({path: '/single/:event_id/applicationfields', version: cur_version}, events.setApplicationFields ); // optional

//server.get({path: '/user/:user_id', version: cur_version}, events.listByUser );
//server.get({path: '/antenna/:antenna_id', version: cur_version}, events.listByAntenna );
//server.get({path: '/antenna/:antenna_id/participation', version: cur_version}, events.listParticipantsInAntenna );

server.get({path: '/status', version: cur_version}, events.status );
server.get({path: '/debug', version: cur_version}, events.debug );

server.listen(config.port, function() {
    console.log('%s listening at %s ', server.name, server.url);
});
