var config = require('./configFile.json');

var exp = config.dev;
if(process.env.NODE_ENV == 'test') {
	for (var attr in config.test) {
		exp[attr] = config.test[attr];
	}
}

module.exports = exp;
