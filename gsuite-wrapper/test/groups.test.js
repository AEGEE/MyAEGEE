const chai = require('chai');
const should = chai.should();
const server = require('../lib/server.js').server;
const request = require('supertest');

//db cross-check
// const admin = require('../config/sdkadmin');
// const db = admin.database();

const TEST_TOKEN = 'belzebu_test';
const TOKEN = TEST_TOKEN;

function delay(interval){
    return it('should delay', done => 
            {setTimeout(() => done(), interval)}
            ).timeout(interval + 100) // The extra 100ms should guarantee the test will not fail due to exceeded timeout
}


describe('Groups', function(){
  
  const primaryEmail = "automated_test_group@aegee.eu";
  const groupName = "The automated test group";

  describe('POST /groups', function(){  
    
    it('Should add a group if valid', function(done){
      
      
      const data = {
        "primaryEmail": primaryEmail,
        "groupName": groupName
      };
       

      request(server)
      .post('/groups')
      //.set('x-auth-token', TOKEN )
      .set('test-title', "create group" )
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
    
    it('Should not add a group if already existing', function(done){
      
      const data = {
        "primaryEmail": primaryEmail,
        "groupName": groupName
      };  

      request(server)
      .post('/groups')
      //.set('x-auth-token', TOKEN )
      .set('test-title', "fail create group" )
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
  
    it('Should not add a group if without primaryEmail', function(done){
      
      const data = {
        "groupName": groupName
      };
        

      request(server)
      .post('/groups')
      //.set('x-auth-token', TOKEN )
      .set('test-title', "fail create group" )
      .send(data)
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

    // useless test?
    xit('Should add a group if without title', function(done){
      
      const data = {
        "primaryEmail": primaryEmail
      };
        

      request(server)
      .post('/groups')
      //.set('x-auth-token', TOKEN )
      .set('test-title', "fail create group 2" )
      .send(data)
      .end(function(resterr, resp) {
        
        let response = 666;
        response = resp.statusCode;
        
        should.not.exist(resterr);
        response.should.not.equal(666);
        response.should.not.equal(200);
        response.should.equal(666);
        done();
        
      }); 
      
    });

    it('Should not add a group if not valid (groupName is empty property)', function(done){
      
      const data = {
        "primaryEmail": primaryEmail,
        "groupName": "" 
      };
        

      request(server)
      .post('/groups')
      //.set('x-auth-token', TOKEN )
      .set('test-title', "fail create group 3" )
      .send(data)
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

    it('Should not add a group if not valid (primaryEmail is empty property)', function(done){
      
      const data = {
        "primaryEmail": "",
        "groupName": groupName
      };
        

      request(server)
      .post('/groups')
      //.set('x-auth-token', TOKEN )
      .set('test-title', "fail create group 4" )
      .send(data)
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

  
  describe('DELETE /groups/:name', function(){

   // delay(1000); 
    
    it('Should remove group', function(done){
      
      this.timeout(3000);

      request(server)
      .delete('/groups/'+primaryEmail)
      //.set('x-auth-token', TOKEN )
      .set('test-title', "delete group" )
      .end(function(resterr, resp) {
        
        let response = 666;
        response = resp.body;

        should.not.exist(resterr);
        resp.statusCode.should.not.equal(666);
        resp.statusCode.should.equal(204);
        done();
        
      });
            
    });

    it('Should not remove group if no string', function(done){
      
      this.timeout(3000);

      request(server)
      .delete('/groups')
      //.set('x-auth-token', TOKEN )
      .set('test-title', "delete group" )
      .end(function(resterr, resp) {
        
        let response = 666;
        response = resp.body;

        should.not.exist(resterr);
        resp.statusCode.should.not.equal(666);
        resp.statusCode.should.equal(404);
        done();
        
      });
            
    });

    it('Should not remove group if empty string', function(done){
      
      this.timeout(3000);

      request(server)
      .delete('/groups/'+"")
      //.set('x-auth-token', TOKEN )
      .set('test-title', "delete group" )
      .end(function(resterr, resp) {
        
        let response = 666;
        response = resp.body;

        should.not.exist(resterr);
        resp.statusCode.should.not.equal(666);
        resp.statusCode.should.equal(404);
        done();
        
      });
            
    });

  });
});
