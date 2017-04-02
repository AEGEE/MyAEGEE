const chai = require('chai');

const assert = chai.assert;
const expect = chai.expect;


describe('Options', () => {
  it('should import options', function (done) {
    var options = require('../../lib/config/options.js');

    options.then(function (res) {
      expect(res).not.to.equal(null);
      done();
    });
  });

  it('should save handshake token to db', function (done) {
    var options = require('../../lib/config/options.js');

    expect(options).not.to.equal(null);

    options.then(function (options) {
      expect(options).not.to.equal(null);

      options.handshake_toḱen = 'someToken';
      options.save(function (err) {
        expect(err).to.be.null;

        var options = require('../../lib/config/options.js');
        options.then(function (options) {
          expect(options.handshake_toḱen).to.equal('someToken');
          done();
        });
      });
    });
  });
});
