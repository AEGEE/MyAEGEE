const nock = require('nock');

const config = require('../../config');

exports.cleanAll = () => nock.cleanAll();

exports.mockMailer = (options) => {
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

    if (options.unsuccessfulResponse) {
        return nock(`${config.mailer.url}:${config.mailer.port}`)
            .persist()
            .post('/')
            .reply(500, { success: false, message: 'Some error' });
    }

    return nock(`${config.mailer.url}:${config.mailer.port}`)
        .persist()
        .post('/', options.body)
        .reply(200, { success: true });
};

exports.mockAll = (options = {}) => {
    nock.cleanAll();

    const mailer = exports.mockMailer(options.mailer || {});

    return {
        mailer
    };
};
