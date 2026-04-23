/*
This is what google expects from the application in order to create an account.
In our code, this payload is sent to a gsuiteOperation as a whole. 

For more fields: 

    https://developers.google.com/admin-sdk/directory/v1/reference/users

*/
const crypto = require('crypto');

function createUserPayload({
    givenName = 'Default',
    surname = 'User',
    primaryEmail = null,
    recoveryEmail = 'recovery@example.com',
    password = 'AEGEE-Europe',
    antenna = 'AEGEE-Timbuktu',
    userPK = null,
} = {}) {

    const payload = {
        // --- Configurable fields ---

        // Logical fallback: if no email provided, create one as firstname.lastname@aegee.eu
        primaryEmail: primaryEmail ?? `${givenName.toLowerCase()}.${surname.toLowerCase()}@aegee.eu`, 
        name: {
            givenName: givenName,
            familyName: surname,
        },
        // Original email used to log in MyAEGEE
        recoveryEmail,

        // Security: Google requires passwords to be hashed if sending a 'hashFunction' property.
        // This converts the password to a SHA-1 hex string.
        password: crypto.createHash('sha1').update(JSON.stringify(password)).digest('hex'),
        
        // Mapping 'antenna' to the 'department' field within Google's organization schema
        organizations: [{ department: antenna }],

        // Primary Key for internal database tracking (Default: name-SURNAME)
        userPK: userPK ?? `${givenName.toLowerCase()}-${surname.toUpperCase()}`,
        emails: [
            {
                address: recoveryEmail, 
                type: 'home',
                customType: '',
                primary: true,
            },
        ],


        // --- Fixed defaults ---
        suspended: true,                    // New accounts are created as suspended for security/review
        hashFunction: 'SHA-1',
        orgUnitPath: '/gsuiteWrapperTest',  // The organizational unit (folder) in Google Admin
        includeInGlobalAddressList: true,   // Whether the user appears in the shared contact list
    };

    return payload;
}

exports.createUserPayload = createUserPayload;