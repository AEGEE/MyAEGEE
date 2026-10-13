const nock = require('nock');

const config = require('../../config');

exports.cleanAll = () => nock.cleanAll();

exports.mockMailer = (options) => {
    if (options.netError) {
        return nock(`${config.mailer.url}:${config.mailer.port}`)
            .persist()
            .post('/')
            .reply(500, 'Some random error.');
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

exports.mockAtlassian = (options) => {
    if (options.netError) {
        return nock(config.bug_report.url)
            .persist()
            .post(/.*/)
            .replyWithError('Some net error');
    }

    if (options.uploadError) {
        nock(config.bug_report.url)
            .persist()
            .post('/upload')
            .reply(500, 'Some error happened.');
    } else {
        nock(config.bug_report.url)
            .persist()
            .post('/upload')
            .reply(200, [{ temporaryAttachmentId: 'temp-attachment-id', fileName: 'valid_image.png' }]);
    }

    if (options.requestError) {
        return nock(config.bug_report.url)
            .persist()
            .post('/request')
            .query(true)
            .reply(400, { friendlyReason: { title: 'We couldn\'t create a request', body: 'E-mail field is required' } });
    }

    return nock(config.bug_report.url)
        .persist()
        .post('/request', options.body)
        .query({ requestTypeId: config.bug_report.request_type_id })
        .reply(200, { key: 'HELP-1' });
};

exports.mockAll = (options = {}) => {
    nock.cleanAll();

    const mailer = exports.mockMailer(options.mailer || {});
    const atlassian = exports.mockAtlassian(options.atlassian || {});

    return {
        mailer,
        atlassian
    };
};
