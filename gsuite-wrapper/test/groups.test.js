const chai = require('chai');
const should = chai.should();
const server = require('../lib/server.js').server;
const { request } = require('./test-helper.js');

function delay(interval){
    return it('should delay', done => 
            {setTimeout(() => done(), interval)}
            ).timeout(interval + 100) // The extra 100ms should guarantee the test will not fail due to exceeded timeout
}

describe('Groups', function(){
  
  const primaryEmail = "automated_test_group@aegee.eu";
  const groupName = "The automated test group";
  const subjectID = "totallyuuid-group";

  const data = {
    "primaryEmail": primaryEmail,
    "groupName": groupName,
    "subjectID": subjectID
  };

  describe('POST /groups', function(){  
    
    it('Should add a group if valid', function(done){
      
      const payload = data;

      const res = await request({
          uri: '/groups',
          method: 'POST',
          headers: { 'test-title': 'create group' },
          body: payload
      });

      resp.statusCode.should.equal(201);
      resp.statusCode.should.equal(true);
      done();
      
    });
    
    it('Should not add a group if already existing', function(done){
      
      const payload = data;  

      request(server)
      .post('/groups')
      //.set('x-auth-token', TOKEN )
      .set('test-title', "fail create group" )
      .send(payload)
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
      
      const payload = data;
      delete payload.primaryEmail;
        
      request(server)
      .post('/groups')
      //.set('x-auth-token', TOKEN )
      .set('test-title', "fail create group" )
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

    it('Should not add a group if without name', function(done){
      
      const payload = data;
      delete payload.groupName;

      request(server)
      .post('/groups')
      //.set('x-auth-token', TOKEN )
      .set('test-title', "fail create group 2" )
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

    it('Should not add a group if without subjectID', function(done){
      
      const payload = data;
      delete payload.subjectID;

      request(server)
      .post('/groups')
      //.set('x-auth-token', TOKEN )
      .set('test-title', "fail create group 2" )
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

    it('Should not add a group if not valid (subjectID is empty property)', function(done){
      
      const payload = data;
      payload.subjectID = "";

      request(server)
      .post('/groups')
      //.set('x-auth-token', TOKEN )
      .set('test-title', "fail create group 3" )
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

    it('Should not add a group if not valid (groupName is empty property)', function(done){
      
      const payload = data;
      payload.groupName = "";

      request(server)
      .post('/groups')
      //.set('x-auth-token', TOKEN )
      .set('test-title', "fail create group 3" )
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

    it('Should not add a group if not valid (primaryEmail is empty property)', function(done){
      
      const payload = data;
      payload.primaryEmail = "";
        

      request(server)
      .post('/groups')
      //.set('x-auth-token', TOKEN )
      .set('test-title', "fail create group 4" )
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

  
  describe('DELETE /groups/:name', function(){

    delay(1500); 
    
    it('Should not remove group if no string', function(done){
      
      //this.timeout(3000);

      request(server)
      .delete('/groups')
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
      
      //this.timeout(3000);

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

    it('Should not remove anything if gibberish string', function(done){
      
      //this.timeout(3000);

      request(server)
      .delete('/groups/giovanniumut')
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

    it('Should not remove anything if gibberish string with spaces', function(done){
      
      //this.timeout(3000);

      request(server)
      .delete('/groups/giova nniumut')
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

    it('Should remove group', function(done){
      
      //this.timeout(3000);
//TODO Add redis here such that I can also check the keys
      request(server)
      .delete('/groups/'+subjectID)
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

  });
});
