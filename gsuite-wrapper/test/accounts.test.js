const chai = require('chai');
const should = chai.should();
const { request } = require('./test-helper.js');
const crypto = require('crypto');

const TEST_TOKEN = 'belzebu_test';
const TOKEN = TEST_TOKEN;

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
  const subjectID = "totallyuuid-account"

  const data = {
    "primaryEmail": generatedUsername,
    "name": {
      "givenName": name,
      "familyName": surname
    },
    "secondaryEmail": email,
    "password": SHA1Password,
    "antenna": antenna,
    "subjectID": subjectID
  };

  describe('POST /accounts', function(){  
    
    it('Should add an account if valid',  async () => {
      this.timeout(3000);
      const payload = data;

      const res = await request({
          uri: '/accounts',
          method: 'POST',
          headers: { 'test-title': 'create account' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(201);
      body.success.should.equal(true);
      
    });
    
    it('Should not add an account if already existing',  async () => {
      
      const payload = data;

      const res = await request({
          uri: '/accounts',
          method: 'POST',
          headers: { 'test-title': 'fail create account' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(409);
      body.success.should.equal(false);
      
    });
  
    it('Should not add an account if without primaryEmail',  async () => {
      
      const payload = data;
      delete payload.primaryEmail;

      const res = await request({
          uri: '/accounts',
          method: 'POST',
          headers: { 'test-title': 'fail create account' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not add an account if primaryEmail is empty',  async () => {
      
      const payload = data;
      payload.primaryEmail = "";

      const res = await request({
          uri: '/accounts',
          method: 'POST',
          headers: { 'test-title': 'fail create account' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not add an account if without secondaryEmail',  async () => {
      
      const payload = data;
      delete payload.secondaryEmail;

      const res = await request({
          uri: '/accounts',
          method: 'POST',
          headers: { 'test-title': 'fail create account' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not add an account if secondaryEmail is empty',  async () => {
      
      const payload = data;
      payload.secondaryEmail = "";

      const res = await request({
          uri: '/accounts',
          method: 'POST',
          headers: { 'test-title': 'fail create account' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not add an account if without password',  async () => {
      
      const payload = data;
      delete payload.password;

      const res = await request({
          uri: '/accounts',
          method: 'POST',
          headers: { 'test-title': 'fail create account' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not add an account if password is empty',  async () => {
      
      const payload = data;
      payload.password = "";

      const res = await request({
          uri: '/accounts',
          method: 'POST',
          headers: { 'test-title': 'fail create account' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not add an account if without antenna',  async () => {
      
      const payload = data;
      delete payload.antenna;

      const res = await request({
          uri: '/accounts',
          method: 'POST',
          headers: { 'test-title': 'fail create account' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not add an account if antenna is empty',  async () => {
      
      const payload = data;
      payload.antenna = "";

      const res = await request({
          uri: '/accounts',
          method: 'POST',
          headers: { 'test-title': 'fail create account' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });
    
    it('Should not add an account if without name',  async () => {
      
      const payload = data;
      delete payload.name.givenName;

      const res = await request({
          uri: '/accounts',
          method: 'POST',
          headers: { 'test-title': 'fail create account' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not add an account if name is empty',  async () => {
      
      const payload = data;
      payload.name.givenName = "";

      const res = await request({
          uri: '/accounts',
          method: 'POST',
          headers: { 'test-title': 'fail create account' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not add an account if without surname',  async () => {
      
      const payload = data;
      delete payload.name.familyName;

      const res = await request({
          uri: '/accounts',
          method: 'POST',
          headers: { 'test-title': 'fail create account' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not add an account if surname is empty',  async () => {
      
      const payload = data;
      payload.name.familyName = "";

      const res = await request({
          uri: '/accounts',
          method: 'POST',
          headers: { 'test-title': 'fail create account' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not add an account if without subjectID',  async () => {
      
      const payload = data;
      delete payload.name.subjectID;

      const res = await request({
          uri: '/accounts',
          method: 'POST',
          headers: { 'test-title': 'fail create account' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not add an account if subjectID is empty',  async () => {
      
      const payload = data;
      payload.name.subjectID = "";

      const res = await request({
          uri: '/accounts',
          method: 'POST',
          headers: { 'test-title': 'fail create account' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });
    
  });

  
});
