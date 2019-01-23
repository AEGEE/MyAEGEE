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

describe('Memberships', function(){
  
  const primaryEmail = "automated_test_group@aegee.eu";
  const groupName = "The automated test group";
  const group_subjectID = "totallyuuid-group";

  const groupData = {
    "primaryEmail": primaryEmail,
    "groupName": groupName,
    "subjectID": group_subjectID
  };

  const name = "Automated";
  const surname = "APITest";
  const generatedUsername = name.toLowerCase()+"."+surname.toLowerCase()+"@aegee.eu";
  const email = "alternatemail817263@mailinator.com";
  const antenna = "AEGEE-Tallahassee";
  const password = "AEGEE-Europe";
  const SHA1Password = crypto.createHash('sha1').update(JSON.stringify(password)).digest('hex');
  const user_subjectID = "totallyuuid-account"

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
    "groupPK": group_subjectID
  }

  before("add group and user", async function(){
    this.timeout(8000);
    let result = await runGsuiteOperation(gsuiteOperations.addGroup, groupData);
    console.log(result);
    result = await runGsuiteOperation(gsuiteOperations.addAccount, accountData);
    console.log(result);

    const group_primaryEmail = primaryEmail;
    const user_primaryEmail = generatedUsername;
    const user_secondaryEmail = email;
    //group
    redis.hset("group:"+group_subjectID, "GsuiteAccount", group_primaryEmail);
    redis.set("primary:"+group_subjectID, group_primaryEmail);
    redis.set("id:"+group_primaryEmail, group_subjectID);
    //user    
    redis.hset("user:"+user_subjectID, "GsuiteAccount", user_primaryEmail, "SecondaryEmail", user_secondaryEmail );
    redis.set("primary:"+user_subjectID, user_primaryEmail);
    redis.set("primary:"+user_secondaryEmail, user_primaryEmail);
    redis.set("id:"+user_primaryEmail, user_subjectID);
    redis.set("secondary:"+user_primaryEmail, user_secondaryEmail);
  });

  after("Remove group and user", async function(){
     this.timeout(8000);

     let keys = await redis.keys('*');
     console.log(keys);

     let result = await runGsuiteOperation(gsuiteOperations.deleteGroup, groupData);
     console.log(result);
     result = await runGsuiteOperation(gsuiteOperations.deleteAccount, accountData);
     console.log(result);

     const group_primaryEmail = primaryEmail;
     const user_primaryEmail = generatedUsername;
     const user_secondaryEmail = email;
     //group
     pip = redis.pipeline();
     pip.hdel("group:"+group_subjectID, "GsuiteAccount");
     pip.del("primary:"+group_subjectID, "id:"+group_primaryEmail);
     //user    
     pip.hdel("user:"+user_subjectID, "GsuiteAccount");
     pip.hdel("user:"+user_subjectID, "SecondaryEmail");
     pip.del("primary:"+user_subjectID, "primary:"+user_secondaryEmail, "id:"+user_primaryEmail, "secondary:"+user_primaryEmail);
     pip.exec( (err, res) => {  console.log(err); console.log(res); } );

     keys = await redis.keys('*');
     console.log(keys);
  });

  describe('PUT /account/:username/group', function(){  
   
    delay(2000); //because they've just been created by the before

    it('Should make a membership if valid', async () => {
      
      const payload = JSON.parse(JSON.stringify(data));

      const res = await request({
          uri: '/account/'+user_subjectID+'/group',
          method: 'PUT',
          headers: { 'test-title': 'create membership' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(201);
      body.success.should.equal(true);
      
    });

    it('Should not make a membership if already present', async () => {
      
      const payload = JSON.parse(JSON.stringify(data));

      const res = await request({
          uri: '/account/'+user_subjectID+'/group',
          method: 'PUT',
          headers: { 'test-title': 'fail create membership' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(409);
      body.success.should.equal(false);
      
    });

    it.skip('Should not make a membership if no :username in url', async () => {
      //THIS should call the controller defined in server.js, which is commented out. 
      //Test is skipped until i fix that
      const payload = JSON.parse(JSON.stringify(data));
      const empty_subjectID = "";

      const res = await request({
          uri: '/account/'+empty_subjectID+'/group',
          method: 'PUT',
          headers: { 'test-title': 'fail create membership' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(404); //OR 500?
      body.success.should.equal(false);
      
    });

    it('Should not make a membership if no operation in payload', async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      payload.operation = "";

      const res = await request({
          uri: '/account/'+user_subjectID+'/group',
          method: 'PUT',
          headers: { 'test-title': 'fail create membership' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not make a membership if no operation in payload', async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      delete payload.operation;

      const res = await request({
          uri: '/account/'+user_subjectID+'/group',
          method: 'PUT',
          headers: { 'test-title': 'fail create membership' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not make a membership if no groupPK in payload', async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      payload.groupPK = "";

      const res = await request({
          uri: '/account/'+user_subjectID+'/group',
          method: 'PUT',
          headers: { 'test-title': 'fail create membership' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not make a membership if no groupPK in payload', async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      delete payload.groupPK;

      const res = await request({
          uri: '/account/'+user_subjectID+'/group',
          method: 'PUT',
          headers: { 'test-title': 'fail create membership' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not add a membership if mistaken payload (swap user&group)', async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      payload.groupPK = user_subjectID;

      const res = await request({
          uri: '/account/'+group_subjectID+'/group',
          method: 'PUT',
          headers: { 'test-title': 'fail make membership' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(404);
      body.success.should.equal(false);
      
    });

    it('Should not remove a membership if mistaken payload (swap user&group)', async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      payload.operation = "remove";
      payload.groupPK = user_subjectID;

      const res = await request({
          uri: '/account/'+group_subjectID+'/group',
          method: 'PUT',
          headers: { 'test-title': 'fail revoke membership' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(404);
      body.success.should.equal(false);
      
    });

    delay(1500);

    it('Should remove a membership if valid', async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      payload.operation = "remove";

      const res = await request({
          uri: '/account/'+user_subjectID+'/group',
          method: 'PUT',
          headers: { 'test-title': 'revoke membership' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(200);
      body.success.should.equal(true);
      
    });

    it('Should not remove a membership if none', async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      payload.operation = "remove";

      const res = await request({
          uri: '/account/'+user_subjectID+'/group',
          method: 'PUT',
          headers: { 'test-title': 'fail revoke membership' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(404);
      body.success.should.equal(false);
      
    });
    
    delay(2000); //for the final removal called in the "after"

  });

  delay(2000);

});
