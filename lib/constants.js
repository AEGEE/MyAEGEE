module.exports = {
    // Whitelist of fields allowed to be updated through PUT /object/:id
    FIELDS_TO_UPDATE: {
        USER: ['username', 'first_name', 'last_name', 'date_of_birth', 'gender', 'phone', 'address', 'about_me']
    }
};
