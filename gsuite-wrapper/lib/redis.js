const config = require('./config/configFile.js');
const log = require('./config/logger.js');

const Redis = require('ioredis');
const redis = new Redis(config.redis);

async function startRedis(){ 
//  const result = await redis.connect();
//  console.log("Redis has started: "+result);
//  log.info("Redis has started: "+result);
//  return result;
  redis.connect().then( () => {
    console.log("Redis has started");
    log.info("Redis has started");
    return res;
  })
}

async function stopRedis(){
  const result = await redis.quit();
  console.log("Redis has stopped: "+result);
  log.info("Redis has stopped: "+result);
  return result;
}

module.exports = {db: redis, stop: stopRedis, start: startRedis};
