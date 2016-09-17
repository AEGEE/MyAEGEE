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
server.use(restify.bodyParser());
server.use(restify.CORS());

//Define your API here

//this endpoint is for public access
//server.post({path: '/authenticate', version: '0.0.6'} , core.authenticate );

//for endpoints declared from here onwards, apply the middleware "verifyToken"
//server.use(core.verifyToken);

// Enable request logging
server.pre(function (request, response, next) {
	request.log.info({req: request}, 'HTTP Request'); 
	return next();
});
//server.on('after', function (req, res, route) {
 // log.trace("Request finished", req, res);
//});

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


server.use(middlewares.authenticateUser);
server.use(middlewares.fetchUserDetails); // TODO merge to one
server.use(middlewares.checkUserRole);


server.get({path: '/', version: cur_version}, events.listEvents );
server.post({path: '/', version: cur_version}, events.addEvent );

// Debugging requests, remove at some point in time
server.get({path: '/status', version: cur_version}, service.status );
server.get({path: '/debug', version: cur_version}, events.debug );
server.get({path: '/getUser', version: cur_version}, service.getUser );
server.get({path: '/roles', version: cur_version}, service.getRoles);
server.put({path: '/roles', version: cur_version}, service.registerRoles);

server.get({path: '/mine/byOrganizer', version: cur_version}, events.listUserOrganizedEvents );
server.get({path: '/mine/byApplication', version: cur_version}, events.listUserAppliedEvents );
server.get({path: '/mine/approvable', version: cur_version}, events.listApprovableEvents );
//server.get({path: '/mine/byLocal', version: cur_version}, events.getUserEvents );


// All requests from here on use the getEvent middleware to fetch a single event from db
server.use(middlewares.fetchSingleEvent);
server.use(middlewares.checkEventPermissions);

server.get({path: '/single/:event_id', version: cur_version}, events.eventDetails );
server.put({path: '/single/:event_id', version: cur_version}, events.editEvent );
server.del({path: '/single/:event_id', version: cur_version}, events.deleteEvent );
server.put({path: '/single/:event_id/status', version: cur_version}, events.setApprovalStatus );
server.get({path: '/single/:event_id/rights', version: cur_version}, events.getEditRights );

server.get({path: '/single/:event_id/participants', version: cur_version}, events.listParticipants );
server.put({path: '/single/:event_id/participants/status/:application_id', version: cur_version}, events.setApplicationStatus )
server.get({path: '/single/:event_id/participants/mine', version: cur_version}, events.getApplication );
server.put({path: '/single/:event_id/participants/mine', version: cur_version}, events.setApplication );

server.get({path: '/single/:event_id/organizers', version: cur_version}, events.listOrganizers );
server.put({path: '/single/:event_id/organizers', version: cur_version}, events.setOrganizers );

//server.get({path: '/single/:event_id/locals', version: cur_version}, events.listOrganizingLocals ); // optional
//server.put({path: '/single/:event_id/locals', version: cur_version}, events.setOrganizingLocals ); // optional

//server.get({path: '/single/:event_id/applicationfields', version: cur_version}, events.listApplicationFields ); // would optimize some frontend views


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