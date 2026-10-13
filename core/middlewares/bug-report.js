const util = require('util');
const multer = require('multer');
const { rateLimit, MemoryStore } = require('express-rate-limit');

const errors = require('../lib/errors');
const log = require('../lib/logger');
const { request } = require('../lib/http');
const config = require('../config');

const upload = util.promisify(multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: config.bug_report.max_file_size,
        files: config.bug_report.max_files
    }
}).array('screenshots'));

// Exported so the tests can reset it.
exports.rateLimitStore = new MemoryStore();

exports.rateLimit = rateLimit({
    windowMs: config.bug_report.rate_limit.window_ms,
    limit: config.bug_report.rate_limit.max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    store: exports.rateLimitStore,
    handler: (req, res) => {
        log.warn({ ip: req.ip, user_id: req.user ? req.user.id : null }, 'Bug report: rate limit exceeded');
        return errors.makeError(res, 429, 'You have sent too many bug reports, please try again later.');
    }
});

const isSuccessful = (response) => response.statusCode >= 200 && response.statusCode < 300;

// Proxy bug reports to Atlassian's JSM widget API, so that we can log issues and limit third-party requests from frontend
exports.reportBug = async (req, res) => {
    try {
        await upload(req, res);
    } catch (err) {
        log.warn({ err }, 'Bug report: could not parse the request');
        return errors.makeValidationError(res, err);
    }

    const files = req.files || [];
    const email = req.body.email || (req.user ? req.user.notification_email : null);
    const reportLog = log.child({
        bug_report: {
            user_id: req.user ? req.user.id : null,
            email,
            summary: req.body.summary,
            files: files.map((file) => ({ name: file.originalname, size: file.size, mimetype: file.mimetype }))
        }
    });

    reportLog.info('Bug report: received, sending to Atlassian');

    try {
        const attachmentIds = [];
        for (const file of files) {
            const formData = new FormData();
            formData.append('file', new Blob([file.buffer], { type: file.mimetype }), file.originalname);

            const uploadResponse = await request({
                url: `${config.bug_report.url}/upload`,
                method: 'POST',
                formData,
                fullResponse: true
            });

            const attachment = Array.isArray(uploadResponse.body) ? uploadResponse.body[0] : null;
            if (!isSuccessful(uploadResponse) || !attachment || !attachment.temporaryAttachmentId) {
                reportLog.error({
                    file: file.originalname,
                    atlassian: { status: uploadResponse.statusCode, body: uploadResponse.body }
                }, 'Bug report: Atlassian rejected the screenshot upload');
                return errors.makeError(res, 502, 'Could not upload the screenshot to the issue tracker.');
            }

            reportLog.info({
                file: file.originalname,
                atlassian: { status: uploadResponse.statusCode, body: uploadResponse.body }
            }, 'Bug report: screenshot uploaded to Atlassian');
            attachmentIds.push(attachment.temporaryAttachmentId);
        }

        const issueResponse = await request({
            url: `${config.bug_report.url}/request`,
            qs: { requestTypeId: config.bug_report.request_type_id },
            method: 'POST',
            body: {
                fields: [
                    { id: 'summary', value: req.body.summary },
                    { id: 'description', value: req.body.description },
                    { id: 'email', value: email },
                    { id: 'attachment', value: attachmentIds }
                ]
            },
            fullResponse: true
        });

        const atlassian = { status: issueResponse.statusCode, body: issueResponse.body };

        if (!isSuccessful(issueResponse)) {
            reportLog.error({ atlassian }, 'Bug report: Atlassian rejected the issue');

            const reason = issueResponse.body && issueResponse.body.friendlyReason
                ? issueResponse.body.friendlyReason.body
                : 'The issue tracker rejected the bug report.';

            // 4xx from Atlassian means the data we sent is invalid, everything else is their problem.
            const statusCode = issueResponse.statusCode >= 400 && issueResponse.statusCode < 500 ? 422 : 502;
            return errors.makeError(res, statusCode, reason);
        }

        reportLog.info({ atlassian }, 'Bug report: issue created in Atlassian');
    } catch (err) {
        reportLog.error({ err }, 'Bug report: could not reach Atlassian');
        return errors.makeError(res, 502, 'Could not reach the issue tracker.');
    }

    return res.json({
        success: true,
        message: 'Your issue is reported.'
    });
};
