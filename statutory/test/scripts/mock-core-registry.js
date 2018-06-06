const nock = require('nock');
const path = require('path');

const config = require('../../config');

exports.cleanAll = () => nock.cleanAll();

exports.mockRegistry = (options) => {
    if (options.netError) {
        return nock(config.registry.url + ':' + config.registry.port)
            .persist()
            .get('/services/oms-core-elixir')
            .replyWithError('Some random error.');
    }

    if (options.badResponse) {
        return nock(config.registry.url + ':' + config.registry.port)
            .persist()
            .get('/services/oms-core-elixir')
            .reply(500, 'Some random error.');
    }

    if (options.unsuccessfulResponse) {
        return nock(config.registry.url + ':' + config.registry.port)
            .persist()
            .get('/services/oms-core-elixir')
            .reply(500, { success: false, message: 'Some error.' });
    }

    return nock(config.registry.url + ':' + config.registry.port)
        .persist()
        .get('/services/oms-core-elixir')
        .replyWithFile(200, path.join(__dirname, '..', 'assets', 'oms-serviceregistry-valid.json'));
};

exports.mockCore = (options) => {
    if (options.netError) {
        return nock('http://oms-core-elixir:4000')
            .persist()
            .get('/members/me')
            .replyWithError('Some random error.');
    }

    if (options.badResponse) {
        return nock('http://oms-core-elixir:4000')
            .persist()
            .get('/members/me')
            .reply(500, 'Some error happened.');
    }

    if (options.unsuccessfulResponse) {
        return nock('http://oms-core-elixir:4000')
            .persist()
            .get('/members/me')
            .reply(500, { success: false, message: 'Some error' });
    }

    if (options.unauthorized) {
        return nock('http://oms-core-elixir:4000')
            .persist()
            .get('/members/me')
            .replyWithFile(403, path.join(__dirname, '..', 'assets', 'oms-core-unauthorized.json'));
    }

    if (options.notSuperadmin) {
        return nock('http://oms-core-elixir:4000')
            .persist()
            .get('/members/me')
            .replyWithFile(200, path.join(__dirname, '..', 'assets', 'oms-core-valid-not-superadmin.json'));
    }

    return nock('http://oms-core-elixir:4000')
        .persist()
        .get('/members/me')
        .replyWithFile(200, path.join(__dirname, '..', 'assets', 'oms-core-valid.json'));
};

exports.mockAll = (options = {}) => {
    nock.cleanAll();
    const omscoreStub = exports.mockCore(options.core || {});
    const omsserviceregistryStub = exports.mockRegistry(options.registry || {});

    return { omscoreStub, omsserviceregistryStub };
};
