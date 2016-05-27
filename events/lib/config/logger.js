var bunyan = require('bunyan');

var log = bunyan.createLogger({
    name: 'oms-core',
    streams: [{
        type: 'rotating-file',
        level: 'info',
        path: './../log/oms-core.log',
        period: '1d',
        count: 7
    }],
    serializers: {
        err: bunyan.stdSerializers.err,
        req: bunyan.stdSerializers.req,
        res: bunyan.stdSerializers.res
    },
    src: true
});

module.exports = log;
