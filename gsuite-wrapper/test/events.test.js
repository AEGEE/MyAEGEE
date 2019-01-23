const chai = require('chai');
const should = chai.should();
const { request } = require('./test-helper.js');
const time = require('moment');

function delay(interval){
    return it('should delay', done => 
            {setTimeout(() => done(), interval)}
            ).timeout(interval + 100) // The extra 100ms should guarantee the test will not fail due to exceeded timeout
}

describe.only('Events', function(){
  
  const eventID = "nettallahassee19"+time().format("MMDoYYhhmmss");//IDs are unique and if an event is cancelled, the ID is still taken, wtf idk
  const eventName = "NWM Tallahassee";
  const location = "Tallahassee, Florida";
  const description = "This NWM is a test by automated API. \n Apply to my.aegee.eu/events/"+eventID;
  const startDate = time().add(2, 'days').format('YYYY-MM-DD'); //format() gives "2015-05-28T09:00:00-07:00";
  const endDate = time().add(5, 'days').format('YYYY-MM-DD'); //use this format to give "all day" events

  const data = {
    "eventID": eventID,
    "name": eventName,
    "location": location,
    "description": description,
    "startDate": startDate,
    "endDate": endDate
  };

  describe.only('POST /calendar', function(){  
    
    it('Should add an event if valid', async () => {
      
      const payload = JSON.parse(JSON.stringify(data));

      const res = await request({
          uri: '/calendar',
          method: 'POST',
          headers: { 'test-title': 'create event' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(201);
      body.success.should.equal(true);
      
    });

    it('Should not add an event if duplicate', async () => {
      
      const payload = JSON.parse(JSON.stringify(data));

      const res = await request({
          uri: '/calendar',
          method: 'POST',
          headers: { 'test-title': 'no create dup event' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(409);
      body.success.should.equal(false);
      
    });

    it('Should not add an event if not valid (eventID is missing)', async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      delete payload.eventID;

      const res = await request({
          uri: '/calendar',
          method: 'POST',
          headers: { 'test-title': 'fail create event' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });
    
    it('Should not add an event if not valid (name is missing)', async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      delete payload.name;

      const res = await request({
          uri: '/calendar',
          method: 'POST',
          headers: { 'test-title': 'fail create event' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not add an event if not valid (location is missing)', async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      delete payload.location;

      const res = await request({
          uri: '/calendar',
          method: 'POST',
          headers: { 'test-title': 'fail create event' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not add an event if not valid (description is missing)', async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      delete payload.description;

      const res = await request({
          uri: '/calendar',
          method: 'POST',
          headers: { 'test-title': 'fail create event' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not add an event if not valid (startDate is missing)', async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      delete payload.startDate;

      const res = await request({
          uri: '/calendar',
          method: 'POST',
          headers: { 'test-title': 'fail create event' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not add an event if not valid (endDate is missing)', async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      delete payload.endDate;

      const res = await request({
          uri: '/calendar',
          method: 'POST',
          headers: { 'test-title': 'fail create event' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not add an event if not valid (eventID is empty)', async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      payload.eventID = "";

      const res = await request({
          uri: '/calendar',
          method: 'POST',
          headers: { 'test-title': 'fail create event' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });
    
    it('Should not add an event if not valid (name is empty)', async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      payload.name = "";

      const res = await request({
          uri: '/calendar',
          method: 'POST',
          headers: { 'test-title': 'fail create event' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not add an event if not valid (location is empty)', async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      payload.location = "";

      const res = await request({
          uri: '/calendar',
          method: 'POST',
          headers: { 'test-title': 'fail create event' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not add an event if not valid (description is empty)', async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      payload.description = "";

      const res = await request({
          uri: '/calendar',
          method: 'POST',
          headers: { 'test-title': 'fail create event' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not add an event if not valid (startDate is empty)', async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      payload.startDate = "";

      const res = await request({
          uri: '/calendar',
          method: 'POST',
          headers: { 'test-title': 'fail create event' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

    it('Should not add an event if not valid (endDate is empty)', async () => {
      
      const payload = JSON.parse(JSON.stringify(data));
      payload.endDate = "";

      const res = await request({
          uri: '/calendar',
          method: 'POST',
          headers: { 'test-title': 'fail create event' },
          body: payload
      });

      const body = res.body;
      res.statusCode.should.equal(400);
      body.success.should.equal(false);
      
    });

  });
});
