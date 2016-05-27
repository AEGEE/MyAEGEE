var expect = require('chai').expect;
var request = require('superagent');

var core = require('../lib/core');
var restify = require('restify');

var userPath = '/users';
var testPort = 1234;

describe('OMS core server', function() {

  beforeEach(function(done) {
    server = restify.createServer();
    server.get({path: userPath, version: '0.0.8'} , core.findAllUsers);
    server.listen(testPort);
    setTimeout(done, 10);
  });

  afterEach(function(done) {
    setTimeout(function() {
      server.close();
      done();
    }, 10);
  });

  describe('serves content at ' + userPath, function() {
    var url = 'http://localhost:' + testPort + userPath;

    it('returns status 200', function(done) {
      request.get(url).end(function(err, res) {
        /*jshint -W030 */
        expect(res).to.exist;
        /*jshint +W030 */
        expect(res.status).to.equal(200);
        done();
      });
    });

  });

});
