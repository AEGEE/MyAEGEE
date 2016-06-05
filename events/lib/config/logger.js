var bunyan = require('bunyan');
var Stream = require('stream');

var consoleStream = new Stream()
consoleStream.writable = true

consoleStream.write = function(obj) {
	// pretty-printing your message
	console.log(obj.msg)
}

var log = bunyan.createLogger({
    name: 'oms-events',
    streams: [{
        type: 'rotating-file',
        level: 'info',
        path: './../log/oms-events.log',
        period: '1d',
        count: 7
    }, {
		type: 'raw',
		stream: consoleStream,
		level: 'info',
	}],
    serializers: {
        err: bunyan.stdSerializers.err,
        req: bunyan.stdSerializers.req,
        res: bunyan.stdSerializers.res
    },
    src: true
});

module.exports = log;
