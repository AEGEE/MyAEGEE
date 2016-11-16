var restify = require('restify');
var events = require('./events.js'); //the real place where the API callbacks are
var imageserv = require('./imageserv.js');
var log = require('./config/logger.js');
var service =  require('./service.js');
var middlewares = require('./middlewares.js');
var cron = require('./cron.js');
var config = require('./config/config.js');


var server = restify.createServer({
    name: 'oms-events',
    log: log
});

server.use(restify.queryParser());
server.use(restify.jsonBodyParser());
//server.use(restify.bodyParser());
server.use(restify.CORS());

//Define your API here

//this endpoint is for public access
//server.post({path: '/authenticate', version: '0.0.6'} , core.authenticate );

//for endpoints declared from here onwards, apply the middleware "verifyToken"
//server.use(core.verifyToken);

// Enable request logging
//server.pre(function (request, response, next) {
//	log.info(request.method + ' ' + request.url); 
//	return next();
//});
server.on('after', function (req, res, route) {
	try {
		log.info(req.method + ' ' + req.url + ' - ' + res._header.split('\n')[0]);
	} catch(err){}
});

server.on('uncaughtException', function(req, res, route, err) {
	log.error(err);
	res.send(err);
})

process.on('uncaughtException', function(err) {
	log.error(err);
	process.exit(1);
})



var cur_version = '0.0.1';

server.use(service.countRequests);
server.get({path: '/registerMicroservice', version: cur_version}, service.registerMicroservice);
server.get({path: '/ping', version: cur_version}, function(req, res, next) {res.send("pong"); return next();});


server.use(middlewares.authenticateUser);

server.get({path: '/', version: cur_version}, events.listEvents );
server.post({path: '/', version: cur_version}, events.addEvent );

// Debugging requests, remove at some point in time
server.get({path: '/status', version: cur_version}, service.status );
server.get({path: '/debug', version: cur_version}, events.debug );
server.get({path: '/getUser', version: cur_version}, [middlewares.fetchUserDetails, middlewares.checkPermissions, service.getUser] );
server.get({path: '/roles', version: cur_version}, [middlewares.fetchUserDetails, middlewares.checkPermissions, service.getRoles] );
server.put({path: '/roles', version: cur_version}, [middlewares.fetchUserDetails, middlewares.checkPermissions, service.registerRoles] );

server.get({path: '/mine/byOrganizer', version: cur_version}, events.listUserOrganizedEvents );
server.get({path: '/mine/byApplication', version: cur_version}, events.listUserAppliedEvents );
server.get({path: '/mine/approvable', version: cur_version}, [middlewares.fetchUserDetails, middlewares.checkPermissions, events.listApprovableEvents] );

server.get({path: '/boardview', version: cur_version}, [middlewares.fetchUserDetails, middlewares.checkPermissions, events.listLocalInvolvedEvents] );


// All requests from here on use the getEvent middleware to fetch a single event from db
server.use(middlewares.fetchSingleEvent);
server.use(middlewares.fetchUserDetails);
server.use(middlewares.checkPermissions);

server.get({path: '/single/:event_id', version: cur_version}, events.eventDetails );
server.put({path: '/single/:event_id', version: cur_version},  events.editEvent );
server.del({path: '/single/:event_id', version: cur_version}, events.deleteEvent );
server.put({path: '/single/:event_id/status', version: cur_version}, events.setApprovalStatus );
server.get({path: '/single/:event_id/rights', version: cur_version}, events.getEditRights );
server.post({path: '/single/:event_id/upload', version: cur_version},  imageserv.uploadImage);

server.get({path: '/single/:event_id/participants', version: cur_version}, events.listParticipants );
server.put({path: '/single/:event_id/participants/status/:application_id', version: cur_version}, events.setApplicationStatus )
server.put({path: '/single/:event_id/participants/comment/:application_id', version: cur_version}, events.setApplicationComment )
server.get({path: '/single/:event_id/participants/mine', version: cur_version}, events.getApplication );
server.put({path: '/single/:event_id/participants/mine', version: cur_version}, events.setApplication );

// possible optimization gets
//server.get({path: '/single/:event_id/organizers', version: cur_version}, events.listOrganizers );
//server.get({path: '/single/:event_id/applicationfields', version: cur_version}, events.listApplicationFields );


//server.get({path: '/user/:user_id', version: cur_version}, events.listByUser );
//server.get({path: '/antenna/:antenna_id', version: cur_version}, events.listByAntenna );
//server.get({path: '/antenna/:antenna_id/participation', version: cur_version}, events.listParticipantsInAntenna );



server.listen(config.port, function() {
	// try if there is a mongodb connection
	require('./config/options.js').then(function(options) {
		log.info("Up and running, %s listening on %s", server.name, server.url);
		cron.scanDB();
	});
});

module.exports = server