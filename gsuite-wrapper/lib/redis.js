const Redis = require('ioredis');
const config = require('./config/configFile');
const log = require('./util/logger');

const redis = new Redis(config.redis);

async function startRedis() {
//  const result = await redis.connect();
//  console.log("Redis has started: "+result);
//  log.info("Redis has started: "+result);
//  return result;
    redis.connect().then(() => {
        log.info('Redis has started');
        return 'YEAH';
    });
}

async function stopRedis() {
    const result = await redis.quit();
    log.info('Redis has stopped: ' + result);
    return result;
}

module.exports = { db: redis, stop: stopRedis, start: startRedis };
