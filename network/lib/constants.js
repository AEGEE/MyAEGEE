module.exports = {
    // Boards whose start date is older than this are not emailed anymore,
    // so a long outage does not welcome boards that started long ago.
    NEW_BOARD_EMAIL_MAX_AGE_DAYS: 7,
    MAIL_SUBJECTS: {
        NEW_BOARD_EMAIL: 'MyAEGEE: Congratulations on the start of your board term!'
    }
};
