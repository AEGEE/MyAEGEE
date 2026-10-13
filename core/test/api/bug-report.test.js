const fs = require('fs');
const os = require('os');
const path = require('path');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const mock = require('../scripts/mock');
const bugReport = require('../../middlewares/bug-report');
const config = require('../../config');

const fields = {
    summary: 'Something is broken',
    description: 'It does not work',
    email: 'reporter@example.com'
};

describe('Bug report', () => {
    beforeAll(async () => {
        await startServer();
    });

    afterAll(async () => {
        await stopServer();
    });

    beforeEach(async () => {
        mock.mockAll();
    });

    afterEach(async () => {
        await generator.clearAll();
        mock.cleanAll();
        bugReport.rateLimitStore.resetAll();
    });

    it('should report the bug without screenshots', async () => {
        const requestsMock = mock.mockAll({
            atlassian: {
                body: {
                    fields: [
                        { id: 'summary', value: fields.summary },
                        { id: 'description', value: fields.description },
                        { id: 'email', value: fields.email },
                        { id: 'attachment', value: [] }
                    ]
                }
            }
        });

        const res = await request({
            path: '/bug-report',
            method: 'POST',
            files: {},
            fields
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(requestsMock.atlassian.isDone()).toEqual(true);
    });

    it('should upload the screenshots and attach them', async () => {
        const requestsMock = mock.mockAll({
            atlassian: {
                body: (body) => body.fields.find((field) => field.id === 'attachment').value[0] === 'temp-attachment-id'
            }
        });

        const res = await request({
            path: '/bug-report',
            method: 'POST',
            files: {
                screenshots: { path: './test/assets/valid_image.png' }
            },
            fields
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toEqual(true);
        expect(requestsMock.atlassian.isDone()).toEqual(true);
    });

    it('should use the notification email of the logged in user if not provided', async () => {
        const user = await generator.createUser({ email: 'notifications@example.com' });
        const token = await generator.createAccessToken(user);

        const requestsMock = mock.mockAll({
            atlassian: {
                body: (body) => body.fields.find((field) => field.id === 'email').value === 'notifications@example.com'
            }
        });

        const res = await request({
            path: '/bug-report',
            method: 'POST',
            headers: { 'X-Auth-Token': token.value },
            files: {},
            fields: { summary: fields.summary, description: fields.description }
        });

        expect(res.statusCode).toEqual(200);
        expect(requestsMock.atlassian.isDone()).toEqual(true);
    });

    it('should return 422 with the Atlassian reason if Atlassian rejects the issue', async () => {
        mock.mockAll({ atlassian: { requestError: true } });

        const res = await request({
            path: '/bug-report',
            method: 'POST',
            files: {},
            fields
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
        expect(res.body.message).toEqual('E-mail field is required');
    });

    it('should return 502 with a generic reason if Atlassian fails without a reason', async () => {
        mock.mockAll({ atlassian: { requestServerError: true } });

        const res = await request({
            path: '/bug-report',
            method: 'POST',
            files: {},
            fields
        });

        expect(res.statusCode).toEqual(502);
        expect(res.body.success).toEqual(false);
        expect(res.body.message).toEqual('The issue tracker rejected the bug report.');
    });

    it('should return 502 if the screenshot upload fails', async () => {
        mock.mockAll({ atlassian: { uploadError: true } });

        const res = await request({
            path: '/bug-report',
            method: 'POST',
            files: {
                screenshots: { path: './test/assets/valid_image.png' }
            },
            fields
        });

        expect(res.statusCode).toEqual(502);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });

    it('should return 502 if Atlassian is unreachable', async () => {
        mock.mockAll({ atlassian: { netError: true } });

        const res = await request({
            path: '/bug-report',
            method: 'POST',
            files: {},
            fields
        });

        expect(res.statusCode).toEqual(502);
        expect(res.body.success).toEqual(false);
        expect(res.body.message).toEqual('Could not reach the issue tracker.');
    });

    it('should return 422 if too many screenshots are uploaded', async () => {
        const res = await request({
            path: '/bug-report',
            method: 'POST',
            files: {
                screenshots: Array(4).fill({ path: './test/assets/valid_image.png' })
            },
            fields
        });

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
    });

    it('should return 422 if the screenshot is too large', async () => {
        const largeFile = path.join(os.tmpdir(), 'bug-report-large-screenshot.png');
        fs.writeFileSync(largeFile, Buffer.alloc(config.bug_report.max_file_size + 1));

        const res = await request({
            path: '/bug-report',
            method: 'POST',
            files: {
                screenshots: { path: largeFile }
            },
            fields
        });

        fs.unlinkSync(largeFile);

        expect(res.statusCode).toEqual(422);
        expect(res.body.success).toEqual(false);
    });

    it('should return 429 if too many bug reports are sent', async () => {
        for (let i = 0; i < config.bug_report.rate_limit.max; i++) {
            const res = await request({
                path: '/bug-report',
                method: 'POST',
                files: {},
                fields
            });

            expect(res.statusCode).toEqual(200);
        }

        const res = await request({
            path: '/bug-report',
            method: 'POST',
            files: {},
            fields
        });

        expect(res.statusCode).toEqual(429);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
    });
});
