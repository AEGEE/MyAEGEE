
var restify = require('restify');
var events = require('./events'); //the real place where the API callbacks are
var log = require('./config/logger');

var config = require('./config/config.json');

var server = restify.createServer({
    name: 'vega',
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

var cur_version = '0.0.1';

server.use(events.countRequests);

server.get({path: '/events', version: cur_version}, events.listEvents );
server.post({path: '/events', version: cur_version}, events.addEvent );

server.get({path: '/events/single/:event_id', version: cur_version}, events.eventDetails );
//server.put({path: '/events/single/:event_id', version: cur_version}, events.editEvent );
server.del({path: '/events/single/:event_id', version: cur_version}, events.deleteEvent );

//server.get({path: '/events/single/:event_id/participants', version: cur_version}, events.listParticipants );
//server.post({path: '/events/single/:event_id/participants', version: cur_version}, events.applyParticipant );

//server.get({path: '/events/single/:event_id/organizers', version: cur_version}, events.listOrganizers );
//server.post({path: '/events/single/:event_id/organizers', version: cur_version}, events.applyOrganizer );

//server.get({path: '/user/:user_id', version: cur_version}, events.listByUser );
//server.get({path: '/antenna/:anntena_id', version: cur_version}, events.listByAntenna );

server.get({path: '/status', version: cur_version}, events.status );
server.get({path: '/debug', version: cur_version}, events.debug );

server.listen(config.port, function() {
    console.log('%s listening at %s ', server.name, server.url);
});
