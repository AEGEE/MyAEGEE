const fs = require('fs');
const path = require('path');

const assetPath = (name) => path.join(__dirname, name);

const loadJson = (name) => JSON.parse(fs.readFileSync(assetPath(name), 'utf8'));

const coreFixtures = {
    profileSuccess: {
        status: 200,
        file: assetPath('core-profile-success.json')
    },
    unauthorized: {
        status: 403,
        file: assetPath('core-auth-unauthorized.json')
    },
    unsuccessful: {
        status: 500,
        file: assetPath('core-envelope-unsuccessful.json')
    }
};

const permissionFixtures = {
    discountsManager: {
        status: 200,
        file: assetPath('core-permissions-discounts-manager.json')
    },
    empty: {
        status: 200,
        file: assetPath('core-permissions-empty.json')
    },
    unrelatedOnly: {
        status: 200,
        file: assetPath('core-permissions-unrelated-only.json')
    },
    malformedEntry: {
        status: 200,
        file: assetPath('core-permissions-malformed-entry.json')
    },
    unauthorized: {
        status: 403,
        file: assetPath('core-auth-unauthorized.json')
    },
    unsuccessful: {
        status: 500,
        file: assetPath('core-envelope-unsuccessful.json')
    }
};

const mailerFixtures = {
    success: {
        status: 200,
        body: loadJson('mailer-success.json')
    },
    unsuccessful: {
        status: 500,
        body: loadJson('mailer-unsuccessful.json')
    }
};

module.exports = {
    assetPath,
    loadJson,
    coreFixtures,
    permissionFixtures,
    mailerFixtures,
    userProfile: loadJson('core-profile-success.json').data
};
