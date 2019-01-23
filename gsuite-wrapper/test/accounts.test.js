const chai = require('chai');
const should = chai.should();
const { request } = require('./test-helper.js');
const {runGsuiteOperation, gsuiteOperations} = require('../lib/google-suite.js');
const crypto = require('crypto');

const redis = require('../lib/redis.js').db;
function delay(interval){
    return it('should delay', done => 
            {setTimeout(() => done(), interval)}
            ).timeout(interval + 100) // The extra 100ms should guarantee the test will not fail due to exceeded timeout
}

describe('Accounts', function(){
  
  const name = "Automated";
  const surname = "APITest";
  const generatedUsername = name.toLowerCase()+"."+surname.toLowerCase()+"@aegee.eu";
  const email = "alternatemail817263@mailinator.com";
  const antenna = "AEGEE-Tallahassee";
  const password = "AEGEE-Europe";
  const SHA1Password = crypto.createHash('sha1').update(JSON.stringify(password)).digest('hex');
  const userPK = "totallyuuid-account"

  const data = {
    "primaryEmail": generatedUsername,
    "name": {
      "givenName": name,
      "familyName": surname
    },
    "secondaryEmail": email,
    "password": SHA1Password,
    "antenna": antenna,
    "userPK": userPK
  };

  after("Remove user", async function(){
    this.timeout(8000);

    let keys = await redis.keys('*');
    console.log(keys);

    let result = await runGsuiteOperation(gsuiteOperations.deleteAccount, data);
    console.log(result);

    const user_primaryEmail = generatedUsername;
    const user_secondaryEmail = email;

    pip = redis.pipeline();

    //user    
    pip.hdel("user:"+userPK, "GsuiteAccount");
    pip.hdel("user:"+userPK, "SecondaryEmail");
    pip.del("primary:"+userPK, "primary:"+user_secondaryEmail, "id:"+user_primaryEmail, "secondary:"+user_primaryEmail);
    pip.exec( (err, res) => {  console.log(err); console.log(res); } );

    keys = await redis.keys('*');
    console.log(keys);
 });

  describe('POST /account', function(){  
    
    it('Should add an account if valid',  async () => {
      this.timeout(3000);
      const payload = JSON.parse(JSON.stringify(data));

      const res = await request({
          uri: '/account',
          method: 'POST',
          headers: { 'test-title': 'create account' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(201);
      body.success.should.equal(true);
      
    });
    
    it('Should not add an account if already existing',  async () => {
      
      const payload = JSON.parse(JSON.stringify(data));

      const res = await request({
          uri: '/account',
          method: 'POST',
          headers: { 'test-title': 'fail create account' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(409);
      body.success.should.equal(false);
      
    });
  
    it('Should not add an account if without primaryEmail',  async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      delete payload.primaryEmail;

      const res = await request({
          uri: '/account',
          method: 'POST',
          headers: { 'test-title': 'fail create account' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not add an account if primaryEmail is empty',  async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      payload.primaryEmail = "";

      const res = await request({
          uri: '/account',
          method: 'POST',
          headers: { 'test-title': 'fail create account' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not add an account if without secondaryEmail',  async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      delete payload.secondaryEmail;

      const res = await request({
          uri: '/account',
          method: 'POST',
          headers: { 'test-title': 'fail create account' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not add an account if secondaryEmail is empty',  async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      payload.secondaryEmail = "";

      const res = await request({
          uri: '/account',
          method: 'POST',
          headers: { 'test-title': 'fail create account' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not add an account if without password',  async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      delete payload.password;

      const res = await request({
          uri: '/account',
          method: 'POST',
          headers: { 'test-title': 'fail create account' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not add an account if password is empty',  async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      payload.password = "";

      const res = await request({
          uri: '/account',
          method: 'POST',
          headers: { 'test-title': 'fail create account' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not add an account if without antenna',  async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      delete payload.antenna;

      const res = await request({
          uri: '/account',
          method: 'POST',
          headers: { 'test-title': 'fail create account' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not add an account if antenna is empty',  async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      payload.antenna = "";

      const res = await request({
          uri: '/account',
          method: 'POST',
          headers: { 'test-title': 'fail create account' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });
    
    it('Should not add an account if without name',  async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      delete payload.name.givenName;

      const res = await request({
          uri: '/account',
          method: 'POST',
          headers: { 'test-title': 'fail create account' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not add an account if name is empty',  async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      payload.name.givenName = "";

      const res = await request({
          uri: '/account',
          method: 'POST',
          headers: { 'test-title': 'fail create account' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not add an account if without surname',  async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      delete payload.name.familyName;

      const res = await request({
          uri: '/account',
          method: 'POST',
          headers: { 'test-title': 'fail create account' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not add an account if surname is empty',  async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      payload.name.familyName = "";

      const res = await request({
          uri: '/account',
          method: 'POST',
          headers: { 'test-title': 'fail create account' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not add an account if without userPK',  async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      delete payload.userPK;

      const res = await request({
          uri: '/account',
          method: 'POST',
          headers: { 'test-title': 'fail create account' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not add an account if userPK is empty',  async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      payload.userPK = "";

      const res = await request({
          uri: '/account',
          method: 'POST',
          headers: { 'test-title': 'fail create account' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });
    
  });

  delay(2000);

});
