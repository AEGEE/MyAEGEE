const request = require('request-promise-native');
const Joi = require('joi');

const { Sequelize, sequelize } = require('../lib/sequelize');
const helpers = require('../lib/helpers');
const constants = require('../lib/constants');

const membersSchema = Joi.array().min(1).items(Joi.object().keys({
    first_name: Joi.string().trim().required(),
    last_name: Joi.string().trim().required(),
    user_id: Joi.number().integer().allow(null).optional(),
    fee: Joi.number().min(0).required()
}));

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
    conversion_rate: {
        allowNull: true,
        type: Sequelize.DECIMAL,
        defaultValue: 1 // no validation as it's not processed by user, but by API instead.
    },
    members: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: '',
        validate: {
            isValid(membersValue) {
                const { error, value } = Joi.validate(membersValue, membersSchema);
                if (error) {
                    throw error;
                }

                // eslint-disable-next-line no-param-reassign
                membersValue = value;
            }
        },
        get() {
            const members = JSON.parse(JSON.stringify(this.getDataValue('members')));
            for (const member of members) {
                member.fee_to_aegee = helpers.calculateFeeForMember(member, this.getDataValue('conversion_rate'));
            }

            return members;
        }
    },
    fee_to_aegee: {
        type: Sequelize.VIRTUAL,
        get() {
            return this.members.reduce((accumulator, member) => accumulator + member.fee_to_aegee, 0);
        }
    }
}, { underscored: true });

// Setting the conversion rate for members list.
MembersList.beforeSave(async (memberslist, options) => {
    // The conversion API returns some currencles under other name,
    // for example euro (EU in the system) is BE.
    const currency = constants.CONVERSION_RATE_MAP[memberslist.currency]
        ? constants.CONVERSION_RATE_MAP[memberslist.currency]
        : memberslist.currency;

    const conversion = await request({
        url: constants.CONVERSION_RATE_API.host + constants.CONVERSION_RATE_API.path,
        method: 'GET',
        simple: false,
        json: true
    });

    if (typeof conversion !== 'object') {
        throw new Error('Malformed response when fetching API rates: ' + conversion);
    }

    const conversionForCurrency = conversion.find(c => c.isoA2Code.toLowerCase() === currency.toLowerCase());
    if (!conversionForCurrency) {
        throw new Error('No currency found: ' + currency);
    }

    memberslist.setDataValue('conversion_rate', conversionForCurrency.value);
    options.fields.push('conversion_rate');
});

module.exports = MembersList;

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
