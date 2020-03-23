module.exports = {
    FIELDS_TO_UPDATE: {
        USER: {
            CREATE: ['username', 'email', 'password', 'first_name', 'last_name', 'date_of_birth', 'gender', 'phone', 'address', 'about_me'],
            UPDATE: ['username', 'first_name', 'last_name', 'date_of_birth', 'gender', 'phone', 'address', 'about_me']
        },
        CIRCLE: {
            CREATE: ['name', 'description']
        },
    },
    FIELDS_TO_QUERY: {
        BODY: ['code', 'name'],
        CAMPAIGN: ['name', 'url', 'description_short', 'description_long'],
        CIRCLE: ['name', 'description'],
        JOIN_REQUEST: [
            '$user.first_name$',
            '$user.last_name$',
            '$user.email$',
        ],
        BODY_MEMBERSHIP: [
            '$user.first_name$',
            '$user.last_name$',
            '$user.email$',
        ],
        MEMBER: ['first_name', 'last_name', 'email'],
        PERMISSION: ['combined', 'description']
    },
    FIELDS_TO_FIND: {
        JOIN_REQUEST: {
            status: 'string'
        }
    },
    TOKEN_LENGTH: {
        MAIL_CONFIRMATION: 128,
        ACCESS_TOKEN: 32,
        REFRESH_TOKEN: 128,
        PASSWORD: 10
    }
};
