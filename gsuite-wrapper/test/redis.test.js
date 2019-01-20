const chai = require('chai');
const should = chai.should();
const server = require('../lib/server.js').server;
const request = require('supertest');

const redis = require('../lib/redis.js');

function delay(interval){
    return it('should delay', done => 
            {setTimeout(() => done(), interval)}
            ).timeout(interval + 100) // The extra 100ms should guarantee the test will not fail due to exceeded timeout
}


//    before("start redis?!", async function(){
//      const result = await redis.start();
//      console.log(result);
//    });

    after("close redis?", async function(){
      const result = await redis.stop();
      console.log(result);
    });

describe('Redis', function(){

    const Redis = redis.db;

    it('should just do fuckign something', function(done){
      Redis.set("ciao","bambina");
      done();
    }); 
  
    it('should just do another something', function(done){
        //redis.get("ciao").then(res => {console.log(res); done();}) ;
        Redis.keys("*").then(res => {console.log(res); done()});
    }); 
    it('should just do another something', function(done){
        //redis.get("ciao").then(res => {console.log(res); done();}) ;
        Redis.get("ciao").then(res => {console.log(res); done()});
    }); 
}); 
