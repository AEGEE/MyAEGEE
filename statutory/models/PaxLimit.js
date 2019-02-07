const { Sequelize, sequelize } = require('../lib/sequelize');

function isPositiveIntOrNull(value) {
    if (typeof value !== 'number' && value !== null) {
        throw new Error('Can be either a number or null.');
    }

    if (typeof value === 'number' && value < 0) {
        throw new Error('Should be positive or 0.');
    }
}

const PaxLimit = sequelize.define('PaxLimit', {
    delegate: {
        type: Sequelize.INTEGER,
        validate: {
            isPositiveIntOrNull
        },
    },
    envoy: {
        type: Sequelize.INTEGER,
        validate: {
            isPositiveIntOrNull
        },
    },
    observer: {
        type: Sequelize.INTEGER,
        validate: {
            isPositiveIntOrNull
        },
    },
    visitor: {
        type: Sequelize.INTEGER,
        validate: {
            isPositiveIntOrNull
        },
    },
    body_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Body ID should be set.' },
            isInt: { msg: 'Body ID should be a number.' }
        }
    },
    event_type: {
        type: Sequelize.ENUM('agora', 'epm'),
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Event type should be set.' },
            isIn: {
                args: [['agora', 'epm']],
                msg: 'Event type should be one of these: "agora", "epm".'
            }
        }
    },
    default: {
        type: Sequelize.VIRTUAL,
        get() {
            // Returning if this record is in the database.
            // The ones returned by defaultLimitForAgora and defaultLimitForEPM are not.
            return this.isNewRecord;
        }
    }
}, { underscored: true, tableName: 'pax_limits' });

// Getting max participants amount for Agora. null is 'unlimited' (no limit)
// This would be called when there's no PaxLimit for specified body (for most of the cases it'd be like that)

// Default ones for agora:
// for antennae and partners: 3 delegates, 30 visitors, no others
// for contact antennae: unlimited envoys, no others
// for contacts: unlimited observers, no others
// for working groups, committees and projects: 3 envoys, 30 visitors, no others
// default one is there if the body type is not one of described above: noone can apply dy default.
/* istanbul ignore next */
function defaultLimitForAgora(type) {
    switch (type) {
    case 'partner':
        return new PaxLimit({ delegate: 0, envoy: 3, visitor: 0, observer: 0 });
    case 'antenna':
        return new PaxLimit({ delegate: 3, envoy: 0, visitor: 30, observer: 0 });
    case 'contact antenna':
        return new PaxLimit({ delegate: 0, envoy: 3, visitor: 30, observer: 0 });
    case 'contact':
        return new PaxLimit({ delegate: 0, envoy: 0, visitor: 0, observer: null });
    case 'working group':
    case 'committee':
    case 'project':
        return new PaxLimit({ delegate: 0, envoy: 3, visitor: 30, observer: 0 });
    default:
        return new PaxLimit({ delegate: 0, envoy: 0, visitor: 0, observer: 0 });
    }
}

// Default ones for EPM:
// unlimited envoys and no others for locals, no one for other (customized in the system
// for CD, ACT and Working groups).
/* istanbul ignore next */
function defaultLimitForEPM(type) {
    switch (type) {
    case 'antenna':
    case 'contact antenna':
    case 'contact':
        return new PaxLimit({ delegate: 0, envoy: null, visitor: 0, observer: 0 });
    default:
        return new PaxLimit({ delegate: 0, envoy: 0, visitor: 0, observer: 0 });
    }
}

PaxLimit.getDefaultForBody = function getDefaultForBody(body, eventType) {
    /* istanbul ignore next */
    const paxLimit = eventType === 'agora'
        ? defaultLimitForAgora(body.type)
        : defaultLimitForEPM(body.type);

    paxLimit.body_id = body.id;
    paxLimit.event_type = eventType;
    return paxLimit;
};

PaxLimit.fetchOrUseDefaultForBody = async function fetchOrUseDefaultForBody(body, eventType) {
    const limit = await this.findOne({ where: { body_id: body.id, event_type: eventType } });
    if (limit) {
        return limit;
    }

    return this.getDefaultForBody(body, eventType);
};

module.exports = PaxLimit;
