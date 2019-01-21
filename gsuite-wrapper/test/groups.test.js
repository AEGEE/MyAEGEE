const chai = require('chai');
const should = chai.should();
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
    
    it('Should add a group if valid', async () => {
      
      const payload = JSON.parse(JSON.stringify(data));

      const res = await request({
          uri: '/groups',
          method: 'POST',
          headers: { 'test-title': 'create group' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(201);
      body.success.should.equal(true);
      
    });
    
    it('Should not add a group if already existing', async () => {
      
      const payload = JSON.parse(JSON.stringify(data));  

      const res = await request({
          uri: '/groups',
          method: 'POST',
          headers: { 'test-title': 'fail create group' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(409);
      body.success.should.equal(false);
      
    });
  
    it('Should not add a group if without primaryEmail', async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      delete payload.primaryEmail;
        
      const res = await request({
          uri: '/groups',
          method: 'POST',
          headers: { 'test-title': 'fail create group 2' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not add a group if without name', async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      delete payload.groupName;

      const res = await request({
          uri: '/groups',
          method: 'POST',
          headers: { 'test-title': 'fail create group 3' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false); 
      
    });

    it('Should not add a group if without subjectID', async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      delete payload.subjectID;

      const res = await request({
          uri: '/groups',
          method: 'POST',
          headers: { 'test-title': 'fail create group' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not add a group if not valid (subjectID is empty property)', async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      payload.subjectID = "";

      const res = await request({
          uri: '/groups',
          method: 'POST',
          headers: { 'test-title': 'fail create group' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not add a group if not valid (groupName is empty property)', async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      payload.groupName = "";

      const res = await request({
          uri: '/groups',
          method: 'POST',
          headers: { 'test-title': 'fail create group' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not add a group if not valid (primaryEmail is empty property)',async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      payload.primaryEmail = "";
        
      const res = await request({
          uri: '/groups',
          method: 'POST',
          headers: { 'test-title': 'fail create group' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });
    
    
  });

  
  describe('DELETE /groups/:name', function(){

    
    it.skip('Should not remove group if no string', async () => {
      //LIKE BELOW FIXME FOR FUCKS SAKE
      //this.timeout(3000);

      const res = await request({
          uri: '/groups',
          method: 'DELETE',
          headers: { 'test-title': 'fail del group' }
      }).catch(err => {console.log('gesu')});

      const body = res.body;
      res.statusCode.should.equal(404);
      body.success.should.equal(false);
            
    });

    it.skip('Should not remove group if empty string', async () => {
      //FIXME FOR FUCKS SAKE THE REQUEST DOESNT HAPPEN OR WHAT?!
      //this.timeout(3000);

      const res = await request({
          uri: '/groups/'+"",
          method: 'DELETE',
          headers: { 'test-title': 'fail del group' }
      }).catch(err => {console.log('gesu')});
console.log(res);
      const body = res.body;
      res.statusCode.should.equal(404);
      body.success.should.equal(false);
            
    });

    it('Should not remove anything if gibberish string', async () => {
      
      //this.timeout(3000);
     
      const res = await request({
          uri: '/groups/giovanniumut',
          method: 'DELETE',
          headers: { 'test-title': 'fail del group' }
      });

      const body = res.body;
      res.statusCode.should.equal(404);
      body.success.should.equal(false);
            
    });

    it('Should not remove anything if gibberish string with spaces', async () => {
      
      //this.timeout(3000);

      const res = await request({
          uri: '/groups/giova nniumut',
          method: 'DELETE',
          headers: { 'test-title': 'fail del group' }
      });

      const body = res.body;
      res.statusCode.should.equal(404);
      body.success.should.equal(false);
            
    });

    delay(1500); 

    it('Should remove group', async () => {
      
      //this.timeout(3000);
//TODO Add redis here such that I can also check the keys
      const res = await request({
        uri: '/groups/'+subjectID,
        method: 'DELETE',
        headers: { 'test-title': 'delete group' }
      });

      const body = res.body;
      res.statusCode.should.equal(200);
      body.success.should.equal(true);
            
    });

  });
});
