module.exports = {
    // The mail domains of AEGEE. Keep equal to RESTRICTED_EMAILS in core/lib/constants.js.
    AEGEE_MAIL_DOMAINS: ['aegee.org', 'aegee.eu'],
    // The sender of the Antenna Criteria fulfilment mail when the request names none.
    FULFILMENT_MAIL_DEFAULT_FROM: 'network@aegee.eu',
    // Boards whose start date is older than this are not emailed anymore,
    // so a long outage does not welcome boards that started long ago.
    NEW_BOARD_EMAIL_MAX_AGE_DAYS: 7,
    MAIL_SUBJECTS: {
        NEW_BOARD_EMAIL: 'MyAEGEE: Congratulations on the start of your board term!'
    }
};
