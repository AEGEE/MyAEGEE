
var restify = require('restify');
var core = require('./core'); //the real place where the API callbacks are
var log = require('./config/logger');

var config = require('./config/config.json');

var server = restify.createServer({
    name: 'calaf',
    log: log
});

server.use(restify.queryParser());
server.use(restify.bodyParser());
server.use(restify.CORS());

//Define job dispatching: here or in the core?
require('./jobs/dispatcher.js');//i would put it in the core just to pass email and ldap object...

//Define your API here

//this endpoint is for public access
server.post({path: '/authenticate', version: '0.0.6'} , core.authenticate );

//for endpoints declared from here onwards, apply the middleware "verifyToken"
server.use(core.verifyToken);

var userPath = '/users';
server.get({path: userPath, version: '0.1.0'} , core.findAllUsers);
server.get({path: userPath + '/:userId' , version: '0.1.0'} , core.findUser);
//sorted by user (given user, to what he applied/is member)
server.get({path: userPath + '/:userId' + '/memberships' , version: '0.1.0'} , core.findMemberships);
server.get({path : userPath +'/:userId' + '/applications' , version : '0.1.0'} , core.findApplicationsOfMember);
//end

server.post({path: userPath + '/create' , version: '0.0.6'} , core.createUser);
server.post({path: userPath + '/:userId' + '/memberships/create' , version: '0.0.6'} , core.createApplication);
server.post({path: userPath + '/:userId' + '/memberships/:bodyCode/modify' , version: '0.0.8'} , core.modifyMembership);

var bodiesPath = '/bodies';
//sorted by antenna (given antenna, who is member/applied)
server.get({path: bodiesPath + '/:bodyCode' + '/applications' , version: '0.1.0'} , core.findApplications);
server.get({path: bodiesPath + '/:bodyCode' + '/members' , version: '0.1.0'} , core.findMembers);
//end

var antennaePath = '/antennae';
server.get({path: antennaePath, version: '0.1.0'} , core.findAllAntennae);
server.get({path: antennaePath + '/:bodyCode' , version: '0.1.0'} , core.findAntenna);
server.post({path: antennaePath + '/create' , version: '0.0.6'} , core.createAntenna);


server.listen(config.port, function() {
    console.log('%s listening at %s ', server.name, server.url);
});
