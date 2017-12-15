const nock = require('nock');
const path = require('path');

const config = require('../../lib/config/config.js');

exports.cleanAll = () => nock.cleanAll();

exports.mockRegistry = (options) => {
  if (options.netError) {
    return nock(config.registry.url + ':' + config.registry.port)
      .persist()
      .get('/services/omscore-nginx')
      .replyWithError('Some random error.');
  }

  if (options.badResponse) {
    return nock(config.registry.url + ':' + config.registry.port)
      .persist()
      .get('/services/omscore-nginx')
      .reply(500, 'Some random error.');
  }

  if (options.unsuccessfulResponse) {
    return nock(config.registry.url + ':' + config.registry.port)
      .persist()
      .get('/services/omscore-nginx')
      .reply(500, { success: false, message: 'Some error.' });
  }

  return nock(config.registry.url + ':' + config.registry.port)
    .persist()
    .get('/services/omscore-nginx')
    .replyWithFile(200, path.join(__dirname, '..', 'assets', 'oms-serviceregistry-valid.json'));
}; 

exports.mockCore = (options) => {
  if (options.netError) {
    return nock('http://omscore-nginx')
      .persist()
      .post('/api/tokens/user')
      .replyWithError('Some random error.');
  }

  if (options.badResponse) {
    return nock('http://omscore-nginx')
      .persist()
      .post('/api/tokens/user')
      .reply(500, 'Some error happened.');
  }

  if (options.unsuccessfulResponse) {
    return nock('http://omscore-nginx')
      .persist()
      .post('/api/tokens/user')
      .reply(500, { success: false, message: 'Some error' });
  }

  if (options.unauthorized) {
    return nock('http://omscore-nginx')
      .persist()
      .post('/api/tokens/user')
      .replyWithFile(403, path.join(__dirname, '..', 'assets', 'oms-core-unauthorized.json'));
  }

  if (options.notSuperadmin) {
    return nock('http://omscore-nginx')
      .persist()
      .post('/api/tokens/user')
      .replyWithFile(200, path.join(__dirname, '..', 'assets', 'oms-core-valid-not-superadmin.json'));
  }

  return nock('http://omscore-nginx')
    .persist()
    .post('/api/tokens/user')
    .replyWithFile(200, path.join(__dirname, '..', 'assets', 'oms-core-valid.json'));
};

exports.mockAll = (options = {}) => {
  nock.cleanAll();
  const omscoreStub = exports.mockCore(options.core || {});
  const omsserviceregistryStub = exports.mockRegistry(options.registry || {});

  return { omscoreStub, omsserviceregistryStub };
};
