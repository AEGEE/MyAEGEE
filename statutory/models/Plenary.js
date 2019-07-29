const moment = require('moment');

const { Sequelize, sequelize } = require('../lib/sequelize');
const Attendance = require('./Attendance');

const Plenary = sequelize.define('plenary', {
    event_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Event should be set.' },
            isInt: { msg: 'Event ID should be a number.' }
        },
    },
    name: {
        type: Sequelize.INTEGER,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Plenary name should be set.' },
        },
    },
    starts: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Plenary start date should be set.' },
            isDate: { msg: 'Plenary start date should be valid.' }
        }
    },
    ends: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Plenary end date should be set.' },
            isDate: { msg: 'Plenary end date should be valid.' },
            laterThanStart(val) {
                if (moment(val).isSameOrBefore(this.starts)) {
                    throw new Error('Plenary cannot start after or at the same time it ends.');
                }
            }
        }
    },
    duration: {
        type: Sequelize.VIRTUAL,
        get() {
            return moment.range(this.starts, this.ends).diff('seconds', true);
        }
    },
}, {
    underscored: true,
    tableName: 'plenaries',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

Plenary.prototype.closeAttendances = async function closeAttendances() {
    await Attendance.update(
        { ends: new Date() },
        { where: { plenary_id: this.id, ends: null } }
    );
};

Plenary.afterUpdate((plenary) => {
    // Yeah, nasty, but prevents us from circular dependencies issues. Been there, done that.
    // eslint-disable-next-line global-require
    const cron = require('../lib/cron');

    // Clearing the deadlines and setting them again on afterSave() (just in case).
    // Only needed on update.
    cron.clearDeadlinesForId(plenary.id);
});

Plenary.afterSave((plenary) => {
    // Yeah, nasty, but prevents us from circular dependencies issues. Been there, done that.
    // eslint-disable-next-line global-require
    const cron = require('../lib/cron');

    // Schedule a deadline for closing all attendances. If it's in the past, cron
    // will catch it.
    cron.registerCloseAttendancesDeadline(plenary.ends, plenary.id);
});

module.exports = Plenary;
