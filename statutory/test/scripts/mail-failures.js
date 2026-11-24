const logger = require('../../lib/logger');
const { request } = require('./helpers');

// The ways a mail about a saved change can fail: the mailer, or the core login and the
// lookup of the board that the board mail needs.
exports.MAIL_FAILURES = [
    ['the mailer gives a net error', { mailer: { netError: true } }],
    ['the mailer gives a bad response', { mailer: { badResponse: true } }],
    ['the mailer refuses the mail', { mailer: { unsuccessfulResponse: true } }],
    ['the core login gives a net error', { login: { netError: true } }],
    ['the core login gives a bad response', { login: { badResponse: true } }],
    ['the core login is refused', { login: { unsuccessfulResponse: true } }],
    ['the board lookup gives a net error', { bodyMembers: { netError: true } }],
    ['the board lookup gives a bad response', { bodyMembers: { badResponse: true } }],
    ['the board lookup is refused', { bodyMembers: { unsuccessfulResponse: true } }]
];

// Spies on the error log: what was logged about mails that could not be sent.
exports.spyOnMailFailures = () => {
    const spy = jest.spyOn(logger, 'error');

    return {
        // The fields of each 'Could not send a mail' entry.
        entries: () => spy.mock.calls
            .filter((args) => args[args.length - 1] === 'Could not send a mail about a saved change')
            .map((args) => args[0]),
        // Everything that was logged as an error, as the logger would write it.
        text: () => spy.mock.calls.map((args) => JSON.stringify(args)).join('\n')
    };
};

// How many mails of this template could not be sent, as /metrics counts them.
exports.countFailedMails = async (template) => {
    const res = await request({ path: '/metrics', method: 'GET', responseType: 'text' });
    const line = res.body.split('\n').find((item) => item.startsWith(`statutory_mails_failed_total{template="${template}"}`));
    return line ? Number(line.split(' ').pop()) : 0;
};
