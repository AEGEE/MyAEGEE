// 'use strict'
// const {runGsuiteOperation, gsuiteOperations} = require('./google-suite');

// const requestPromise = require('request-promise-native');

// const request = requestPromise.defaults({
//     json: true,
//     resolveWithFullResponse: true,
//     simple: false,
//     baseUrl: 'http://oms-core-elixir:4000/api'
// });

// async function login_to_core_and_return_users(user, query){
//   const token =  await request({
//     uri: '/login',
//     method: 'POST',
//     body: user
//   });

//   const res = await request({
//     uri: query,
//     method: 'GET',
//     headers: { 'auth': token.access_token }
//   });

//   return res;
// }

// const user_list_request={
//   domain: "aegee.eu",
//   maxResults: 500,
//   orderBy: "email",
//   projection: "basic",
//   sortOrder: "ASCENDING",
//   viewType: "admin_view",
//   query: "orgUnitPath=/individuals"
// }

// async function map_existing_users () {
//   const list_of_gsuite_users = await runGsuiteOperation(gsuiteOperations.listAccounts, user_list_request);
//   const list_of_core_users = await login_to_core_and_return_users({username: "admin@aegee.org", password: "supersecret"}, "/members");

//   //how is the data returned see https://developers.google.com/admin-sdk/directory/v1/reference/users/list?apix_params=%7B%22domain%22%3A%22aegee.eu%22%2C%22maxResults%22%3A5%2C%22orderBy%22%3A%22email%22%2C%22projection%22%3A%22basic%22%2C%22sortOrder%22%3A%22DESCENDING%22%2C%22viewType%22%3A%22admin_view%22%7D
//   list_of_gsuite_users.forEach(gsuite_user => {

//     // FIND BY REGISTERED EMAIL
//     let core_user = list_of_core_users.find(function (element){
//       return element.email == gsuite_user.emails[0].address; // the secondary address is found this way (quite weak..)
//     });

//     if (core_user != null){
//       redis.add(core_user.user_id, gsuite_user.primaryEmail);
//     }else{

//       // FIND BY NAME/SURNAME
//       core_user = list_of_core_users.find(function (element){
//         return (element.last_name  == gsuite_user.name.familyName &&
//                 element.first_name == gsuite_user.name.givenName)
//       }); // NB ritorna solo la PRIMA persona che ha quel nome/cognome

//       if (core_user != null){
//         redis.add(core_user.user_id, gsuite_user.primaryEmail);
//       }else{
//         redis.add("unfound:"+gsuite_user.primaryEmail, "o shit");
//       }
//     }
//   });
// }

// map_existing_users();

// // function create_account_for_the_others (){
// //   foreach user in list_of_core_users
// //   if redis.get(core_user.user_id) == null
// //     runGsuiteOperation(gsuiteOperations.create, {core_user}); // USE THE API INSTEAD! or redis won't be populated
// //     sleep 10;
// // FIND A WAY TO HAVE DRY-RUN FIRST!

// // }

// // create_account_for_the_others ();
