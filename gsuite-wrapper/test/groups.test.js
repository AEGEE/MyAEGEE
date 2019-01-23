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
  const bodyPK = "totallyuuid-group";

  const data = {
    "primaryEmail": primaryEmail,
    "groupName": groupName,
    "bodyPK": bodyPK
  };

  describe('POST /group', function(){  
    
    it('Should add a group if valid', async () => {
      
      const payload = JSON.parse(JSON.stringify(data));

      const res = await request({
          uri: '/group',
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
          uri: '/group',
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
          uri: '/group',
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
          uri: '/group',
          method: 'POST',
          headers: { 'test-title': 'fail create group 3' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false); 
      
    });

    it('Should not add a group if without bodyPK', async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      delete payload.bodyPK;

      const res = await request({
          uri: '/group',
          method: 'POST',
          headers: { 'test-title': 'fail create group' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not add a group if not valid (bodyPK is empty property)', async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      payload.bodyPK = "";

      const res = await request({
          uri: '/group',
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
          uri: '/group',
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
          uri: '/group',
          method: 'POST',
          headers: { 'test-title': 'fail create group' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });
    
    
  });

  
  describe('DELETE /group/:name', function(){

    
    it.skip('Should not remove group if no string', async () => {
      //LIKE BELOW FIXME FOR FUCKS SAKE
      //this.timeout(3000);

      const res = await request({
          uri: '/group',
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
          uri: '/group/'+"",
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
          uri: '/group/giovanniumut',
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
          uri: '/group/giova nniumut',
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
        uri: '/group/'+bodyPK,
        method: 'DELETE',
        headers: { 'test-title': 'delete group' }
      });

      const body = res.body;
      res.statusCode.should.equal(200);
      body.success.should.equal(true);
            
    });

  });

  delay(2000);

});
