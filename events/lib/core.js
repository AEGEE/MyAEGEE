//PREAMBLE STUFF
var assert = require('assert');
var _ldap = require('./config/ldap.js');
var _mail = require('./config/mail.js');

var log = require('./config/logger');

var config = require('./config/config.json');
var jwt    = require('jsonwebtoken');

var ldap_top_dn = 'o=aegee, c=eu';//TODO what to do with it? where to put?


_ldap.bindSuper();


//API DEFINITION

//v0.0.6 middleware
exports.verifyToken = function(req, res, next) {

  // check header or url parameters or post parameters for token
  var token = req.params.token || req.query.token || req.headers['x-access-token'];

  if (token) {

    jwt.verify(token, config.secret, function(err, decoded) {      
      if (err) {
        return res.json({ success: false, message: 'Failed to authenticate token.' });    
      } else {
        req.decoded = decoded;    
        next();
      }
    });

  } else {
    // return error if no token
    return res.send(403, { success: false, message: 'No token provided.' });
  }
};

//v0.0.6
exports.authenticate = function(req, res, next) {

  var uid = req.params.username;
  var password = req.params.password;
  var user = req.params.user;

  log.info(user, 'User is requesting a token');
      
  // find the user  
  _ldap.bindUser('uid='+uid+',ou=people,o=aegee,c=eu', password, function(err) {
    if(err){
      log.info({err: err}, 'LDAP user binding');
      res.json({ success: false, message: 'Authentication failed. ' });
    }
    
    return generateToken(res, user);
  });

  //console.log("done2");
};



//v0.1.0 - remember to bump version numbers
exports.findAllUsers = function(req, res , next) {
    req.log.debug({req: req}, 'findAllUsers request');
    res.setHeader('Access-Control-Allow-Origin', '*');

    var searchDN = 'ou=people, ' + ldap_top_dn;
    var filter = '(objectClass=aegeePersonFab)';

    _ldap.searchLDAP(filter, searchDN, res);
};

//v0.1.0 - remember to bump version numbers
exports.findUser = function(req, res , next) {
    req.log.debug({req: req}, 'findUser request');
    res.setHeader('Access-Control-Allow-Origin', '*');

    var searchDN = 'ou=people, ' + ldap_top_dn;
    var filter = '(&(uid=' + req.params.userId + ')(objectClass=aegeePersonFab))';

    _ldap.searchLDAP(filter, searchDN, res);
};

//this finds the membership *of a person*
//v0.1.0 - remember to bump version numbers
exports.findMemberships = function(req, res , next) {
    req.log.debug({req: req}, 'findMemberships request');
    res.setHeader('Access-Control-Allow-Origin', '*');

    var searchDN = 'uid=' + req.params.userId + ', ou=people, ' + ldap_top_dn;
    var filter = '(&(objectClass=aegeePersonMembership)!(memberType=Applicant))';

    _ldap.searchLDAP(filter, searchDN, res);
};

//this finds the membership *of a person*
//v0.1.0 - remember to bump version numbers
exports.findApplicationsOfMember = function(req, res , next) {
    req.log.debug({req: req}, 'findApplicationsOfMember request');
    res.setHeader('Access-Control-Allow-Origin', '*');

    var searchDN = 'uid=' + req.params.userId + ', ou=people, ' + ldap_top_dn;
    var filter = '(&(objectClass=aegeePersonMembership)(memberType=Applicant))';

    _ldap.searchLDAP(filter, searchDN, res);
};

//this finds the applications *to a body*
//v0.1.0 - remember to bump version numbers
exports.findApplications = function(req, res , next) { //cannot do "find all applications" method because of API call routes
    req.log.debug({req: req}, 'findApplications request');
    res.setHeader('Access-Control-Allow-Origin', '*');

    var searchDN = 'ou=people, ' + ldap_top_dn;
    var filter = '(&(&(objectClass=aegeePersonMembership)(memberType=Applicant))(bodyCode=' + req.params.bodyCode + '))';

    _ldap.searchLDAP(filter, searchDN, res);
};

//this finds the members *of a body*
//v0.1.0 - remember to bump version numbers
exports.findMembers = function(req, res , next) { //cannot do "find all applications" method because of API call routes
    req.log.debug({req: req}, 'findMembers request');
    res.setHeader('Access-Control-Allow-Origin', '*');

    var searchDN = 'ou=people, ' + ldap_top_dn;
    var filter = '(&(&(objectClass=aegeePersonMembership)(memberType=Member))(bodyCode=' + req.params.bodyCode + '))';

    _ldap.searchLDAP(filter, searchDN, res);
};

//v0.1.0 - remember to bump version numbers
exports.findAllAntennae = function(req, res , next) {
    req.log.debug({req: req}, 'findAllAntennae request');
    res.setHeader('Access-Control-Allow-Origin', '*');

    var searchDN = 'ou=bodies, ' + ldap_top_dn;
    var filter = '(&(objectClass=aegeeBodyFab)(bodyCategory=Local))';

    _ldap.searchLDAP(filter, searchDN, res);
};

//v0.1.0 - remember to bump version numbers
exports.findAntenna = function(req, res , next) {
    req.log.debug({req: req}, 'findAntenna request');
    res.setHeader('Access-Control-Allow-Origin', '*');

    var searchDN = 'ou=bodies, ' + ldap_top_dn;
    var filter = '(&(bodyCode=' + req.params.bodyCode + ')(objectClass=aegeeBodyFab))';

    _ldap.searchLDAP(filter, searchDN, res);
};

//v0.0.6 - remember to bump version numbers
exports.createUser = function(req, res , next) {
    req.log.debug({req: req}, 'createUser request');
    res.setHeader('Access-Control-Allow-Origin', '*');

    var baseDN = 'ou=people, ' + ldap_top_dn;

    var entry = {
      sn: req.params.sn,
      givenName: req.params.givenName,
      cn: req.params.cn,
      uid: req.params.givenName + '.' + req.params.sn, //TODO: check clashes between existing UIDs  (#2)
      mail: req.params.mail,
      userPassword: req.params.userPassword,
      birthDate: req.params.birthDate,
      objectclass: 'aegeePersonFab'
    };

    _ldap.addEntry('uid=' + entry.uid + ',' + baseDN, entry);

    res.send(201, entry);

    //TRIGGER: apply to body registered with
};

//v0.0.6 - remember to bump version numbers
exports.createAntenna = function(req, res , next) {
    req.log.debug({req: req}, 'createAntenna request');
    res.setHeader('Access-Control-Allow-Origin', '*');

    var baseDN = 'ou=bodies, ' + ldap_top_dn;

    var entry = {
      bodyCategory: req.params.bodyCategory,
      bodyCode: req.params.bodyCode, //TODO: check clashes between existing UIDs
      bodyNameAscii: req.params.bodyNameAscii,
      mail: req.params.mail,
      netcom: req.params.netcom,
      bodyStatus: 'C',                //if newly created, automatically is Contact
      objectclass: 'aegeeBodyFab'
    };


    _ldap.addEntry('bodyCode=' + entry.bodyCode + ',' + baseDN, entry);

    res.send(201, entry);

    //TRIGGER: create local groups (e.g. board) entries

};

//v0.0.6 - remember to bump version numbers
exports.createApplication = function(req, res , next) { 
    req.log.debug({req: req}, 'createApplication request');
    res.setHeader('Access-Control-Allow-Origin', '*');

    var baseDN = 'uid=' + req.params.userId + ', ou=people, ' + ldap_top_dn;

    //TODO: check if UID already existing

    var entry = {
      bodyCategory: req.params.bodyCategory,
      bodyCode: req.params.bodyCode, //TODO: check clashes between existing UIDs (#2)
      bodyNameAscii: req.params.bodyNameAscii,
      mail: req.params.mail,
      uid: req.params.uid,
      cn: req.params.cn,
      memberSinceDate: req.params.memberSinceDate,
      memberUntilDate: req.params.memberUntilDate,
      memberType: 'Applicant',
      objectclass: 'aegeePersonMembership'
    };

    _ldap.addEntry('bodyCode=' + entry.bodyCode + ',' + baseDN, entry);

    res.send(201, entry);

    //TRIGGER: send email to board of applied body

};

//v0.0.8 - remember to bump version numbers
exports.modifyMembership = function(req, res , next) {
    req.log.debug({req: req}, 'modifyMembership request');
    res.setHeader('Access-Control-Allow-Origin', '*');

    var baseDN = 'bodyCode=' + req.params.bodyCode + ',uid=' + req.params.userId + ', ou=people, ' + ldap_top_dn;
    var searchDN = 'uid=' + req.params.userId + ',ou=people, ' + ldap_top_dn;
    var filter = '(&(bodyCode=' + req.params.bodyCode + ')(objectClass=aegeePersonMembership))';

    _ldap.modifyMembership(baseDN, req.params.memberType, function(filter, searchDN, res) {
      
      _ldap.searchLDAP(filter,searchDN,res, function(res, data){
                  
                  //send mail accordingly
                  var mailmessage = {
                     to:      data[0].cn+" <"+data[0].mail+">",
                     subject: "Your membership has changed",
                     text:    "Hi "+data[0].cn+", \n your membership has changed to "+data[0].memberType
                  };
                  _mail.sendMail(mailmessage);

                  //send a response
                  res.send(200,data);
                });
    }(filter,searchDN,res) );

    //TODO: membership should begin from acceptance date, not from application date (maybe)
    //
    //if changed to "suspended", the system won't remember what was before that
    
};


//HELPER or INTERNAL METHODS


//v0.1.0
function generateToken(res, user){ 

  var token = jwt.sign(user, config.secret, {
    expiresIn: 21600 // (in seconds) - expires in 6 hours
  });

  //after all is well, before returning the token 
  // re-bind with privileged user
  _ldap.bindSuper(function(err) { 
      log.info({err: err}, 'LDAP client binding');
      assert.ifError(err);

      // return the information including token as JSON
      res.json({
        success: true,
        message: 'Enjoy your token!',
        token: token    
      });
    });

};

