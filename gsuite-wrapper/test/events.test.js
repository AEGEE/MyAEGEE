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
  
  const eventID = "nettallahassee19";
  const eventName = "NWM Tallahassee";
  const location = "Tallahassee, Florida";
  const description = "This NWM is a test by automated API";
  const startDate = time().add(2, 'days').format(); //"2015-05-28T09:00:00-07:00";
  const endDate = time().add(5, 'days').format();;

  const data = {
    "eventID": eventID,
    "name": eventName,
    "location": location,
    "description": description,
    "startDate": startDate,
    "endDate": endDate
  };

  describe('POST /calendar', function(){  
    
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
    
  });
});
