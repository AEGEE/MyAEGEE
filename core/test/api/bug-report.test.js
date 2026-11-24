const fs = require('fs');
const os = require('os');
const path = require('path');
const Logger = require('bunyan');

const { startServer, stopServer } = require('../../lib/server');
const { request } = require('../scripts/helpers');
const generator = require('../scripts/generator');
const mock = require('../scripts/mock');
const bugReport = require('../../middlewares/bug-report');
const log = require('../../lib/logger');
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

    it('should log the user id of the reporter, and not their email or the report text', async () => {
        const user = await generator.createUser({ email: 'notifications@example.com' });
        const token = await generator.createAccessToken(user);
        mock.mockAll();

        const written = [];
        jest.spyOn(log, 'child').mockImplementation((childFields) => {
            written.push(childFields);
            return log;
        });
        jest.spyOn(Logger.prototype, 'info').mockImplementation((...args) => {
            written.push(args);
        });

        try {
            const res = await request({
                path: '/bug-report',
                method: 'POST',
                headers: { 'X-Auth-Token': token.value },
                files: {},
                fields: { summary: fields.summary, description: fields.description }
            });

            expect(res.statusCode).toEqual(200);
        } finally {
            jest.restoreAllMocks();
        }

        const logged = JSON.stringify(written);
        expect(logged).toContain(`"user_id":${user.id}`);
        expect(logged).not.toContain('notifications@example.com');
        expect(logged).not.toContain(fields.summary);
        expect(logged).not.toContain(fields.description);
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

    it('should log only the status when Atlassian rejects the issue', async () => {
        mock.mockAll({ atlassian: { requestError: true } });
        const errorLog = jest.spyOn(Logger.prototype, 'error');

        try {
            await request({
                path: '/bug-report',
                method: 'POST',
                files: {},
                fields
            });
        } finally {
            jest.restoreAllMocks();
        }

        expect(errorLog).toHaveBeenCalledWith({ atlassian: { status: 400 } }, 'Bug report: Atlassian rejected the issue');
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

    it('should log only the status when Atlassian rejects the screenshot upload', async () => {
        mock.mockAll({ atlassian: { uploadError: true } });
        const errorLog = jest.spyOn(Logger.prototype, 'error');

        try {
            await request({
                path: '/bug-report',
                method: 'POST',
                files: {
                    screenshots: { path: './test/assets/valid_image.png' }
                },
                fields
            });
        } finally {
            jest.restoreAllMocks();
        }

        expect(errorLog).toHaveBeenCalledWith(
            { file: 'valid_image.png', atlassian: { status: 500 } },
            'Bug report: Atlassian rejected the screenshot upload'
        );
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

        const warnLog = jest.spyOn(log, 'warn');
        let res;
        try {
            res = await request({
                path: '/bug-report',
                method: 'POST',
                files: {},
                fields
            });
        } finally {
            jest.restoreAllMocks();
        }

        expect(res.statusCode).toEqual(429);
        expect(res.body.success).toEqual(false);
        expect(res.body).toHaveProperty('message');
        // The user id only, not the client address.
        expect(warnLog).toHaveBeenCalledWith({ user_id: null }, 'Bug report: rate limit exceeded');
    });

    // Reports of people who are not logged in and leave no email are taken as well.
    it('should report the bug without an email if nobody is logged in and none is given', async () => {
        const requestsMock = mock.mockAll({
            atlassian: {
                body: {
                    fields: [
                        { id: 'summary', value: fields.summary },
                        { id: 'description', value: fields.description },
                        { id: 'email', value: null },
                        { id: 'attachment', value: [] }
                    ]
                }
            }
        });

        const res = await request({
            path: '/bug-report',
            method: 'POST',
            files: {},
            fields: { summary: fields.summary, description: fields.description }
        });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual({ success: true, message: 'Your issue is reported.' });
        expect(requestsMock.atlassian.isDone()).toEqual(true);
    });

    it('should return 429 to a logged-in member who sends too many bug reports, and log their id', async () => {
        const user = await generator.createUser();
        const token = await generator.createAccessToken(user);

        for (let i = 0; i < config.bug_report.rate_limit.max; i++) {
            const res = await request({
                path: '/bug-report',
                method: 'POST',
                headers: { 'X-Auth-Token': token.value },
                files: {},
                fields
            });

            expect(res.statusCode).toEqual(200);
        }

        // A report that got through to the issue tracker now would answer 502.
        mock.mockAll({ atlassian: { netError: true } });

        const warnLog = jest.spyOn(log, 'warn');
        let res;
        try {
            res = await request({
                path: '/bug-report',
                method: 'POST',
                headers: { 'X-Auth-Token': token.value },
                files: {},
                fields
            });
        } finally {
            jest.restoreAllMocks();
        }

        expect(res.statusCode).toEqual(429);
        expect(res.body).toEqual({
            success: false,
            message: 'You have sent too many bug reports, please try again later.'
        });
        expect(warnLog).toHaveBeenCalledWith({ user_id: user.id }, 'Bug report: rate limit exceeded');
    });
});
