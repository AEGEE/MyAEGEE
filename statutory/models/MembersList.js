const { Sequelize, sequelize } = require('../lib/sequelize');
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
            isValid (value) {
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
                    for (const key of ['first_name', 'last_name', 'fee']) {
                        if (!member[key]) {
                            throw new Error('The "' + key + '" attribute is not set for a member.');
                        }
                    }

                    if (Number.isNaN(Number(member.fee))) {
                      throw new Error('The fee is invalid for the user.')
                    }

                    if (member.fee <= 0) {
                      throw new Error('Member\'s fee should be positive number.');
                    }
                }
            }
        }
    }
}, { underscored: true });

module.exports = MembersList;
