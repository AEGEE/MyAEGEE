const chai = require('chai');
const should = chai.should();
const { request } = require('./test-helper.js');
const {runGsuiteOperation, gsuiteOperations} = require('../lib/google-suite.js');
const redis = require('../lib/redis.js').db;
const crypto = require('crypto');


function delay(interval){
    return it('should delay', done => 
            {setTimeout(() => done(), interval)}
            ).timeout(interval + 100) // The extra 100ms should guarantee the test will not fail due to exceeded timeout
}

describe('Aliases', function(){

  const name = "Automated";
  const surname = "APITest";
  const generatedUsername = name.toLowerCase()+"."+surname.toLowerCase()+"@aegee.eu";
  const email = "alternatemail817263@mailinator.com";
  const antenna = "AEGEE-Tallahassee";
  const password = "AEGEE-Europe";
  const SHA1Password = crypto.createHash('sha1').update(JSON.stringify(password)).digest('hex');
  const userPK = "totallyuuid-account";
  const userAlias = "alias_for_user_test@aegee.eu";
  const otherAlias = "other_alias_for_test@aegee.eu";

  const accountData = {
    "primaryEmail": generatedUsername,
    "name": {
      "givenName": name,
      "familyName": surname
    },
    "password": SHA1Password,
    "hashFunction": "SHA-1",
    "emails": [
    {
      "address": email,
      "type": "home",
      "customType": "",
      "primary": true
    }
    ],
    "organizations": [
    {
        "department": antenna
    }
    ],
    "orgUnitPath": "/individuals",
    "includeInGlobalAddressList": true
  }

  const data = {
    "operation": "add",
    "aliasName": userAlias
  }

  before("add the user", async function(){
    this.timeout(8000);
    let result = await runGsuiteOperation(gsuiteOperations.addAccount, accountData);
    console.log(result);

    const user_primaryEmail = generatedUsername;
    const user_secondaryEmail = email;

    //user    
    redis.hset("user:"+userPK, "GsuiteAccount", user_primaryEmail, "SecondaryEmail", user_secondaryEmail );
    redis.set("primary:"+userPK, user_primaryEmail);
    redis.set("primary:"+user_secondaryEmail, user_primaryEmail);
    redis.set("id:"+user_primaryEmail, userPK);
    redis.set("secondary:"+user_primaryEmail, user_secondaryEmail);
  });

  after("Remove user", async function(){
     this.timeout(8000);

     let keys = await redis.keys('*');
     console.log(keys);

     let result = await runGsuiteOperation(gsuiteOperations.deleteAccount, accountData);
     console.log(result);

     const user_primaryEmail = generatedUsername;
     const user_secondaryEmail = email;

     pip = redis.pipeline();

     //user    
     pip.hdel("user:"+userPK, "GsuiteAccount");
     pip.hdel("user:"+userPK, "SecondaryEmail");
     pip.del("primary:"+userPK, "primary:"+user_secondaryEmail, "id:"+user_primaryEmail, "secondary:"+user_primaryEmail);
     pip.srem("alias:"+userPK, otherAlias); //this to remove *from redis* the alias that comes from the deletion of the user
     pip.exec( (err, res) => {  console.log(err); console.log(res); } );

     keys = await redis.keys('*');
     console.log(keys);
  });

  describe('PUT /account/:username/alias', function(){  

    delay(2000); //because they've just been created by the before

    describe("Create", function(){  
        it('Should make an alias if valid', async () => {
          
          const payload = JSON.parse(JSON.stringify(data));

          const res = await request({
              uri: '/account/'+userPK+'/alias',
              method: 'PUT',
              headers: { 'test-title': 'create alias' },
              body: payload
          });

          const body = res.body;
          res.statusCode.should.equal(201);
          body.success.should.equal(true);
          
        });

        it('Should not make an alias if already present', async () => {
          
          const payload = JSON.parse(JSON.stringify(data));

          const res = await request({
              uri: '/account/'+userPK+'/alias',
              method: 'PUT',
              headers: { 'test-title': 'fail create alias' },
              body: payload
          });

          const body = res.body;
          res.statusCode.should.equal(409);
          body.success.should.equal(false);
          
        });

        it.skip('Should not make an alias if no :username in url', async () => {
          //THIS should call the controller defined in server.js, which is commented out. 
          //Test is skipped until i fix that
          const payload = JSON.parse(JSON.stringify(data));
          const empty_subjectID = "";

          const res = await request({
              uri: '/account/'+empty_subjectID+'/alias',
              method: 'PUT',
              headers: { 'test-title': 'fail create alias' },
              body: payload
          });

          const body = res.body;
          res.statusCode.should.equal(404); //OR 500?
          body.success.should.equal(false);
          
        });

        it('Should not make an alias if no operation in payload', async () => {
          
          const payload = JSON.parse(JSON.stringify(data));
          payload.operation = "";

          const res = await request({
              uri: '/account/'+userPK+'/alias',
              method: 'PUT',
              headers: { 'test-title': 'fail create alias' },
              body: payload
          });

          const body = res.body;
          res.statusCode.should.equal(400);
          body.success.should.equal(false);
          
        });

        it('Should not make an alias if no operation in payload', async () => {
          
          const payload = JSON.parse(JSON.stringify(data));
          delete payload.operation;

          const res = await request({
              uri: '/account/'+userPK+'/alias',
              method: 'PUT',
              headers: { 'test-title': 'fail create alias' },
              body: payload
          });

          const body = res.body;
          res.statusCode.should.equal(400);
          body.success.should.equal(false);
          
        });

        it('Should not make an alias if no aliasName in payload', async () => {
          
          const payload = JSON.parse(JSON.stringify(data));
          payload.aliasName = "";

          const res = await request({
              uri: '/account/'+userPK+'/alias',
              method: 'PUT',
              headers: { 'test-title': 'fail create alias' },
              body: payload
          });

          const body = res.body;
          res.statusCode.should.equal(400);
          body.success.should.equal(false);
          
        });

        it('Should not make an alias if no aliasName in payload', async () => {
          
          const payload = JSON.parse(JSON.stringify(data));
          delete payload.aliasName;

          const res = await request({
              uri: '/account/'+userPK+'/alias',
              method: 'PUT',
              headers: { 'test-title': 'fail create alias' },
              body: payload
          });

          const body = res.body;
          res.statusCode.should.equal(400);
          body.success.should.equal(false);
          
        });

        it('Should not add an alias if mistaken payload (swap user&alias)', async () => {
          
          const payload = JSON.parse(JSON.stringify(data));
          payload.aliasName = userPK;

          const res = await request({
              uri: '/account/'+userAlias+'/group',
              method: 'PUT',
              headers: { 'test-title': 'fail add alias' },
              body: payload
          });

          const body = res.body;
          res.statusCode.should.equal(400);
          body.success.should.equal(false);

         console.log(body); 
        });

        it('Should not remove an alias if mistaken payload (swap user&alias)', async () => {
          
          const payload = JSON.parse(JSON.stringify(data));
          payload.operation = "remove";
          payload.aliasName = userPK;

          const res = await request({
              uri: '/account/'+userAlias+'/group',
              method: 'PUT',
              headers: { 'test-title': 'fail remove alias' },
              body: payload
          });

          const body = res.body;
          res.statusCode.should.equal(400);
          body.success.should.equal(false);
          
         console.log(body); 
        });

    });

    describe("Read", function(){  

        it('#GET: Should correctly retrieve single alias', async () => {
          
          const res = await request({
              uri: '/account/'+userPK+'/alias',
              method: 'GET',
              headers: { 'test-title': 'get alias' },
          });

          body = res.body;
          res.statusCode.should.equal(200);
          body.success.should.equal(true);
          
        });

        it('#GET: Should correctly retrieve multiple aliases', async () => {
          
          //First add a second alias
          const payload = JSON.parse(JSON.stringify(data));
          payload.aliasName = otherAlias; 

          let res = await request({
              uri: '/account/'+userPK+'/alias',
              method: 'PUT',
              headers: { 'test-title': 'get alias (add 2nd alias)' },
              body: payload
          });

          let body = res.body;
          res.statusCode.should.equal(201);
          body.success.should.equal(true);

          res = await request({
              uri: '/account/'+userPK+'/alias',
              method: 'GET',
              headers: { 'test-title': 'get alias' },
          });

          body = res.body;
          res.statusCode.should.equal(200);
          body.success.should.equal(true);
          
        });
        
    });
    
    describe("Delete", function(){  

        delay(1500);

        it('Should remove an alias if valid', async () => {
          
          const payload = JSON.parse(JSON.stringify(data));
          payload.operation = "remove";

          const res = await request({
              uri: '/account/'+userPK+'/alias',
              method: 'PUT',
              headers: { 'test-title': 'remove alias' },
              body: payload
          });

          const body = res.body;
          res.statusCode.should.equal(200);
          body.success.should.equal(true);
          
        });

        it('Should not remove an alias if none', async () => {
          
          const payload = JSON.parse(JSON.stringify(data));
          payload.operation = "remove";

          const res = await request({
              uri: '/account/'+userPK+'/alias',
              method: 'PUT',
              headers: { 'test-title': 'fail remove alias' },
              body: payload
          });

          const body = res.body;
          res.statusCode.should.equal(400);
          body.success.should.equal(false);
          
        });
        
        delay(2000); //for the final removal called in the "after"
    
    });

  });
  
  delay(2000);

});