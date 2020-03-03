module.exports = {
    FIELDS_TO_UPDATE: {
        USER: {
            CREATE: ['username', 'email', 'password', 'first_name', 'last_name', 'date_of_birth', 'gender', 'phone', 'address', 'about_me'],
            UPDATE: ['username', 'first_name', 'last_name', 'date_of_birth', 'gender', 'phone', 'address', 'about_me']
        }
    },
    TOKEN_LENGTH: {
        MAIL_CONFIRMATION: 128,
        ACCESS_TOKEN: 32,
        REFRESH_TOKEN: 128,
        PASSWORD: 10
    }
};
