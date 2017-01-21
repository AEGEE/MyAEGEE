const bunyan = require('bunyan');

let log;

if (process.env.NODE_ENV === 'test') {
  log = bunyan.createLogger({
    name: 'oms-events',
    streams: [],
    serializers: {
      err: bunyan.stdSerializers.err,
      req: bunyan.stdSerializers.req,
      res: bunyan.stdSerializers.res,
    },
    src: true,
  });
} else {
  log = bunyan.createLogger({
    name: 'oms-events',
    streams: [/* {
        //type: 'rotating-file',
        level: 'trace',
        path: './log/oms-events.log',
        //period: '1d',
        //count: 7
    },*/
    // Uncomment for console logging
      {
        stream: process.stdout,
        level: 'debug',
      },
    ],
    serializers: {
      err: bunyan.stdSerializers.err,
      req: bunyan.stdSerializers.req,
      res: bunyan.stdSerializers.res,
    },
    src: true,
  });
}

module.exports = log;
