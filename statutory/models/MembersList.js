const { Sequelize, sequelize } = require('../lib/sequelize');
const helpers = require('../lib/helpers');

const MembersList = sequelize.define('memberslist', {
    event_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Event ID should be set.' },
            isInt: { msg: 'Event ID should be a number.' }
        },
    },
    user_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'User ID should be set.' },
            isInt: { msg: 'User ID should be a number.' }
        },
    },
    body_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Body ID should be set.' },
            isInt: { msg: 'Body ID should be a number.' }
        },
    },
    currency: {
        allowNull: false,
        type: Sequelize.STRING,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Currency should be set.' }
        },
    },
    members: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: '',
        validate: {
            isValid(value) {
                if (typeof value === 'undefined' || value === '') {
                    throw new Error('Members should be set.');
                }

                if (!Array.isArray(value)) {
                    throw new Error('Members is not an array.');
                }

                if (value.length === 0) {
                    throw new Error('Members list is empty.');
                }

                for (const member of value) {
                    if (typeof member !== 'object' || member === null) {
                        throw new Error('Member should be an object.');
                    }

                    for (const key of ['first_name', 'last_name', 'fee']) {
                        if (typeof member[key] === 'undefined') {
                            throw new Error('The "' + key + '" attribute is not set for a member.');
                        }
                    }

                    for (const key of ['first_name', 'last_name']) {
                        if (typeof member[key] !== 'string') {
                            throw new Error(`${key} should be a string.`);
                        }

                        if (member[key].trim() === '') {
                            throw new Error(`${key} should not be empty.`);
                        }
                    }

                    for (const key of ['fee']) {
                        if (typeof member[key] !== 'number') {
                            throw new Error(`${key} is not a number.`);
                        }
                    }

                    if (typeof member.user_id !== 'undefined' && member.user_id !== null && typeof member.user_id !== 'number') {
                        throw new Error('user_id is set, but is not a number.');
                    }

                    if (member.fee < 0) {
                        throw new Error('Member\'s fee should be not negative number.');
                    }
                }
            }
        }
    }
}, { underscored: true });

// Updating the users' inclusion in memberslist for this body.
MembersList.afterSave(async (memberslist) => {
    // Prevent circular model loading.
    // eslint-disable-next-line global-require
    const Application = require('./Application');

    const applicationsForBody = await Application.findAll({ where: {
        body_id: memberslist.body_id,
        event_id: memberslist.event_id
    } });

    for (const application of applicationsForBody) {
        const isOnMemberslist = helpers.memberslistHasMember(memberslist, application);
        await application.update(
            { is_on_memberslist: isOnMemberslist },
            { hooks: false } // to prevent unnecessary queries for memberslists on application
        );
    }
});

module.exports = MembersList;
