const nock = require('nock');

const config = require('../../config');
const fixtures = require('../assets');

exports.cleanAll = () => nock.cleanAll();

function replyWithFixture(scope, fixture) {
    return scope.replyWithFile(fixture.status, fixture.file);
}

function getCoreProfileFixture(options) {
    if (options.fixture) {
        return fixtures.coreFixtures[options.fixture];
    }

    if (options.unsuccessfulResponse) {
        return fixtures.coreFixtures.unsuccessful;
    }

    if (options.unauthorized) {
        return fixtures.coreFixtures.unauthorized;
    }

    return fixtures.coreFixtures.profileSuccess;
}

function getPermissionFixture(options) {
    if (options.fixture) {
        return fixtures.permissionFixtures[options.fixture];
    }

    if (options.noPermissions) {
        return fixtures.permissionFixtures.empty;
    }

    if (options.unsuccessfulResponse) {
        return fixtures.permissionFixtures.unsuccessful;
    }

    if (options.unauthorized) {
        return fixtures.permissionFixtures.unauthorized;
    }

    return fixtures.permissionFixtures.discountsManager;
}

function getMailerFixture(options) {
    if (options.fixture) {
        return fixtures.mailerFixtures[options.fixture];
    }

    if (options.unsuccessfulResponse) {
        return fixtures.mailerFixtures.unsuccessful;
    }

    return fixtures.mailerFixtures.success;
}

exports.mockCore = (options) => {
    if (options.netError) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/members/me')
            .replyWithError('Some random error.');
    }

    if (options.badResponse) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/members/me')
            .reply(500, 'Some error happened.');
    }

    return replyWithFixture(
        nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/members/me'),
        getCoreProfileFixture(options)
    );
};

exports.mockCoreMainPermissions = (options) => {
    if (options.netError) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/my_permissions')
            .replyWithError('Some random error.');
    }

    if (options.badResponse) {
        return nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/my_permissions')
            .reply(500, 'Some error happened.');
    }

    return replyWithFixture(
        nock(`${config.core.url}:${config.core.port}`)
            .persist()
            .get('/my_permissions'),
        getPermissionFixture(options)
    );
};

exports.mockCoreMailer = (options) => {
    if (options.netError) {
        return nock(`${config.mailer.url}:${config.mailer.port}`)
            .persist()
            .post('/')
            .replyWithError('Some random error.');
    }

    if (options.badResponse) {
        return nock(`${config.mailer.url}:${config.mailer.port}`)
            .persist()
            .post('/')
            .reply(500, 'Some error happened.');
    }

    const fixture = getMailerFixture(options);
    return nock(`${config.mailer.url}:${config.mailer.port}`)
        .persist()
        .post('/')
        .reply(fixture.status, fixture.body);
};

exports.fixtures = fixtures;

exports.mockAll = (options = {}) => {
    nock.cleanAll();
    const omsCoreStub = exports.mockCore(options.core || {});
    const omsMainPermissionsStub = exports.mockCoreMainPermissions(options.mainPermissions || {});
    const omsMailerStub = exports.mockCoreMailer(options.mailer || {});

    return {
        omsCoreStub,
        omsMainPermissionsStub,
        omsMailerStub
    };
};
