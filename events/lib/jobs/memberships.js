

var _ldap = require('../config/ldap.js');
var ldap_top_dn = 'o=aegee, c=eu';



module.exports = function(agenda) {
  agenda.define('Check membership expiration', function(job, done) {

    var today = new Date();
    //remember that months go from 0 to 11
    var date = today.getDate()+"/"+(today.getMonth()+1)+"/"+today.getFullYear();

    //Query (or receive queried object) for an array containing
    //ACTIVE memberships who have expiration date before Today()
    //--------------------
    var searchDN = 'ou=people, ' + ldap_top_dn;
    var filter = '(&(objectClass=aegeePersonMembership)(&(memberType=Member)(memberUntilDate=' + date + ')))';

    //TODO: check Date() format vs ldap

    _ldap.searchLDAP(filter, searchDN, null, expireMemberships);

  });

  // More scheduled membership-related jobs (save member list every X months)
}

//USEFUL
function expireMemberships(res, users){//res has to be burnt..

  //console.log(users); 

  var usersDN = [];
  //we extract the DN of the users
  for(var i=0; i<users.length; ++i){
    usersDN.push(users[i].dn);
  }

  console.log("Expiring membership from cron for %s users", users.length);
  _ldap.modifyMembershipCron(users, "Suspended");

};
