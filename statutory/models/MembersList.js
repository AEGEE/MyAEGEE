const Joi = require('joi');

const { Sequelize, sequelize } = require('../lib/sequelize');
const { request } = require('../lib/http');
const helpers = require('../lib/helpers');
const constants = require('../lib/constants');
const config = require('../config');

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
                const { error, value } = membersSchema.validate(membersValue);
                if (error) {
                    throw error;
                }

                // Storing the members as the schema reads them: numbers as numbers, names trimmed.
                this.setDataValue('members', value);
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
    },
    fee_paid: {
        allowNull: false,
        type: Sequelize.DECIMAL,
        defaultValue: 0,
        validate: {
            notNull: { msg: 'Fee paid should be set.' },
            isNumeric: { msg: 'Fee paid should be a number.' },
            min: { args: [0], msg: 'Fee paid should be positive.' }
        },
    },
    fee_not_paid: {
        type: Sequelize.VIRTUAL,
        get() {
            return helpers.normalizeMoney(this.fee_to_aegee - this.fee_paid);
        }
    }
}, {
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// The currency rates server did not answer in time, failed, or answered something else.
class RatesUnavailable extends Error {}
MembersList.RatesUnavailable = RatesUnavailable;

// The conversion rate of a currency to euro, from the European Commission's server, or null
// for a currency the server does not list. It is fetched before the members list is saved
// (see lib/memberslists.js), so that no database connection waits for it, and given up on
// after conversion_rate_api.timeout.
MembersList.fetchConversionRate = async (currency) => {
    // The conversion API returns some currencles under other name,
    // for example euro (EU in the system) is BE.
    const code = (constants.CONVERSION_RATE_MAP[currency] || currency).toLowerCase();

    let conversion;
    try {
        conversion = await request({
            url: config.conversion_rate_api.host + constants.CONVERSION_RATE_API.path,
            method: 'GET',
            timeout: config.conversion_rate_api.timeout
        });
    } catch (err) {
        throw new RatesUnavailable(`Could not fetch the currency rates: ${err.message}`);
    }

    if (!Array.isArray(conversion)) {
        throw new RatesUnavailable('Malformed response when fetching the currency rates');
    }

    const conversionForCurrency = conversion.find((c) => c.isoA2Code.toLowerCase() === code);
    return conversionForCurrency ? conversionForCurrency.value : null;
};

// Setting the conversion rate for members list: the one fetched before the save, given as
// the conversionRate option, or fetched here (for a save outside of a request).
MembersList.beforeSave(async (memberslist, options) => {
    const rate = options.conversionRate === undefined
        ? await MembersList.fetchConversionRate(memberslist.currency)
        : options.conversionRate;

    // After the validation, so that a currency that is too long gets that message first.
    if (rate === null) {
        // A validation error on the currency field, so the client gets it like the other ones.
        const message = 'The currency is not known.';
        throw new Sequelize.ValidationError(message, [
            new Sequelize.ValidationErrorItem(message, 'Validation error', 'currency', memberslist.currency)
        ]);
    }

    memberslist.setDataValue('conversion_rate', rate);
    options.fields.push('conversion_rate');
});

module.exports = MembersList;

// Updating the users' inclusion in memberslist for this body.
MembersList.afterSave(async (memberslist, options) => {
    // Prevent circular model loading.
    // eslint-disable-next-line global-require
    const Application = require('./Application');

    // In the transaction of the save, if any.
    const applicationsForBody = await Application.findAll({
        where: {
            body_id: memberslist.body_id,
            event_id: memberslist.event_id
        },
        transaction: options.transaction
    });

    for (const application of applicationsForBody) {
        const isOnMemberslist = helpers.memberslistHasMember(memberslist, application);
        await application.update(
            { is_on_memberslist: isOnMemberslist },
            { hooks: false, transaction: options.transaction } // to prevent unnecessary queries for memberslists on application
        );
    }
});

module.exports = MembersList;
