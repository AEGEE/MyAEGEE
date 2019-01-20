const chai = require('chai');
const should = chai.should();
const server = require('../lib/server.js').server;
const request = require('supertest');
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

  const payload = {
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
    
    it('Should add an account if valid', function(done){
      this.timeout(3000);
      const data = payload;

      request(server)
      .post('/accounts')
      .set('test-title', "create account" )
      .send(data)
      .end(function(resterr, resp) {
        
        let response = 666;
        response = resp.body;

        should.not.exist(resterr);
        resp.statusCode.should.not.equal(666);
        resp.statusCode.should.equal(201);
        done();
        
      }); 
      
    });
    
    it('Should not add an account if already existing', function(done){
      
      const data = payload;

      request(server)
      .post('/accounts')
      .set('test-title', "fail create account" )
      .send(data)
      .end(function(resterr, resp) {
        
        let response = 666;
        response = resp.statusCode;
        
        should.not.exist(resterr);
        response.should.not.equal(666);
        response.should.not.equal(200);
        response.should.equal(409);
        done();
        
      }); 
      
    });
  
    it('Should not add an account if without primaryEmail', function(done){
      
      const data = payload;
      delete data.primaryEmail;

      request(server)
      .post('/accounts')
      .set('test-title', "fail create account" )
      .send(payload)
      .end(function(resterr, resp) {
        
        let response = 666;
        response = resp.statusCode;
        
        should.not.exist(resterr);
        response.should.not.equal(666);
        response.should.not.equal(200);
        response.should.equal(400);
        done();
        
      }); 
      
    });

    it('Should not add an account if primaryEmail is empty', function(done){
      
      const data = payload;
      data.primaryEmail = "";

      request(server)
      .post('/accounts')
      .set('test-title', "fail create account" )
      .send(payload)
      .end(function(resterr, resp) {
        
        let response = 666;
        response = resp.statusCode;
        
        should.not.exist(resterr);
        response.should.not.equal(666);
        response.should.not.equal(200);
        response.should.equal(400);
        done();
        
      }); 
      
    });

    it('Should not add an account if without secondaryEmail', function(done){
      
      const data = payload;
      delete data.secondaryEmail;

      request(server)
      .post('/accounts')
      .set('test-title', "fail create account" )
      .send(payload)
      .end(function(resterr, resp) {
        
        let response = 666;
        response = resp.statusCode;
        
        should.not.exist(resterr);
        response.should.not.equal(666);
        response.should.not.equal(200);
        response.should.equal(400);
        done();
        
      }); 
      
    });

    it('Should not add an account if secondaryEmail is empty', function(done){
      
      const data = payload;
      data.secondaryEmail = "";

      request(server)
      .post('/accounts')
      .set('test-title', "fail create account" )
      .send(payload)
      .end(function(resterr, resp) {
        
        let response = 666;
        response = resp.statusCode;
        
        should.not.exist(resterr);
        response.should.not.equal(666);
        response.should.not.equal(200);
        response.should.equal(400);
        done();
        
      }); 
      
    });

    it('Should not add an account if without password', function(done){
      
      const data = payload;
      delete data.password;

      request(server)
      .post('/accounts')
      .set('test-title', "fail create account" )
      .send(payload)
      .end(function(resterr, resp) {
        
        let response = 666;
        response = resp.statusCode;
        
        should.not.exist(resterr);
        response.should.not.equal(666);
        response.should.not.equal(200);
        response.should.equal(400);
        done();
        
      }); 
      
    });

    it('Should not add an account if password is empty', function(done){
      
      const data = payload;
      data.password = "";

      request(server)
      .post('/accounts')
      .set('test-title', "fail create account" )
      .send(payload)
      .end(function(resterr, resp) {
        
        let response = 666;
        response = resp.statusCode;
        
        should.not.exist(resterr);
        response.should.not.equal(666);
        response.should.not.equal(200);
        response.should.equal(400);
        done();
        
      }); 
      
    });

    it('Should not add an account if without antenna', function(done){
      
      const data = payload;
      delete data.antenna;

      request(server)
      .post('/accounts')
      .set('test-title', "fail create account" )
      .send(payload)
      .end(function(resterr, resp) {
        
        let response = 666;
        response = resp.statusCode;
        
        should.not.exist(resterr);
        response.should.not.equal(666);
        response.should.not.equal(200);
        response.should.equal(400);
        done();
        
      }); 
      
    });

    it('Should not add an account if antenna is empty', function(done){
      
      const data = payload;
      data.antenna = "";

      request(server)
      .post('/accounts')
      .set('test-title', "fail create account" )
      .send(payload)
      .end(function(resterr, resp) {
        
        let response = 666;
        response = resp.statusCode;
        
        should.not.exist(resterr);
        response.should.not.equal(666);
        response.should.not.equal(200);
        response.should.equal(400);
        done();
        
      }); 
      
    });
    
    it('Should not add an account if without name', function(done){
      
      const data = payload;
      delete data.name.givenName;

      request(server)
      .post('/accounts')
      .set('test-title', "fail create account" )
      .send(payload)
      .end(function(resterr, resp) {
        
        let response = 666;
        response = resp.statusCode;
        
        should.not.exist(resterr);
        response.should.not.equal(666);
        response.should.not.equal(200);
        response.should.equal(400);
        done();
        
      }); 
      
    });

    it('Should not add an account if name is empty', function(done){
      
      const data = payload;
      data.name.givenName = "";

      request(server)
      .post('/accounts')
      .set('test-title', "fail create account" )
      .send(payload)
      .end(function(resterr, resp) {
        
        let response = 666;
        response = resp.statusCode;
        
        should.not.exist(resterr);
        response.should.not.equal(666);
        response.should.not.equal(200);
        response.should.equal(400);
        done();
        
      }); 
      
    });

    it('Should not add an account if without surname', function(done){
      
      const data = payload;
      delete data.name.familyName;

      request(server)
      .post('/accounts')
      .set('test-title', "fail create account" )
      .send(payload)
      .end(function(resterr, resp) {
        
        let response = 666;
        response = resp.statusCode;
        
        should.not.exist(resterr);
        response.should.not.equal(666);
        response.should.not.equal(200);
        response.should.equal(400);
        done();
        
      }); 
      
    });

    it('Should not add an account if surname is empty', function(done){
      
      const data = payload;
      data.name.familyName = "";

      request(server)
      .post('/accounts')
      .set('test-title', "fail create account" )
      .send(payload)
      .end(function(resterr, resp) {
        
        let response = 666;
        response = resp.statusCode;
        
        should.not.exist(resterr);
        response.should.not.equal(666);
        response.should.not.equal(200);
        response.should.equal(400);
        done();
        
      }); 
      
    });

    it('Should not add an account if without subjectID', function(done){
      
      const data = payload;
      delete data.name.subjectID;

      request(server)
      .post('/accounts')
      .set('test-title', "fail create account" )
      .send(payload)
      .end(function(resterr, resp) {
        
        let response = 666;
        response = resp.statusCode;
        
        should.not.exist(resterr);
        response.should.not.equal(666);
        response.should.not.equal(200);
        response.should.equal(400);
        done();
        
      }); 
      
    });

    it('Should not add an account if subjectID is empty', function(done){
      
      const data = payload;
      data.name.subjectID = "";

      request(server)
      .post('/accounts')
      .set('test-title', "fail create account" )
      .send(payload)
      .end(function(resterr, resp) {
        
        let response = 666;
        response = resp.statusCode;
        
        should.not.exist(resterr);
        response.should.not.equal(666);
        response.should.not.equal(200);
        response.should.equal(400);
        done();
        
      }); 
      
    });
    
  });

  
});
