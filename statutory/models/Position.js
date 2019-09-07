const moment = require('moment');

const { Sequelize, sequelize } = require('../lib/sequelize');

const Position = sequelize.define('Position', {
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
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Position name should be set.' },
        }
    },
    starts: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Position start date should be set.' },
            isDate: { msg: 'Position start date should be valid.' }
        }
    },
    ends: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Position end date should be set.' },
            isDate: { msg: 'Position end date should be valid.' },
            laterThanStart(val) {
                if (moment(val).isSameOrBefore(this.starts)) {
                    throw new Error('Position cannot start after or at the same time it ends.');
                }
            }
        }
    },
    ends_force: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Position force close deadline should be set.' },
            isDate: { msg: 'Position force close deadline should be valid.' },
            laterThanEnd(val) {
                if (moment(val).isSameOrBefore(this.ends)) {
                    throw new Error('Position\'s force close deadline cannot be before the regular deadline.');
                }
            }
        }
    },
    places: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Places amount should be set.' },
            isNumeric: { msg: 'Places amount should be valid.' },
            min: { args: [1], msg: 'Places amount should be at least 1' }
        }
    },
    status: {
        type: Sequelize.ENUM('open', 'closed'),
        allowNull: false,
        defaultValue: 'open',
        validate: {
            isIn: {
                args: [['open', 'closed']],
                msg: 'Position status can be one of these: "open", "closed".'
            }
        }
    },
    can_apply: {
        type: Sequelize.VIRTUAL,
        get() {
            return moment().isBetween(this.starts, this.ends, null, '[]'); // inclusive
        }
    }
}, {
    underscored: true,
    tableName: 'positions',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

Position.beforeCreate(async (position, options) => {
    // We set the status either to "open" or "closed"
    // based on starts and ends params.
    // Also if it should start in the future, we set the cron task for it
    // to open applications.

    // TODO: refactor
    const canApply = moment().isBetween(position.starts, position.ends, null, '[]');

    position.setDataValue('status', canApply ? 'open' : 'closed');
    options.fields.push('status');
});

Position.afterUpdate((position) => {
    // Yeah, nasty, but prevents us from circular dependencies issues. Been there, done that.
    // eslint-disable-next-line global-require
    const cron = require('../lib/cron');

    // Clearing the deadlines and setting them again on afterSave() (just in case).
    // Only needed on update.
    cron.clearJobs(cron.JOB_TYPES.OPEN_POSITION_APPLICATIONS, { id: position.id });
    cron.clearJobs(cron.JOB_TYPES.CLOSE_POSITION_APPLICATIONS, { id: position.id });
});

Position.afterSave(async (position) => {
    // Yeah, nasty, but prevents us from circular dependencies issues. Been there, done that.
    // eslint-disable-next-line global-require
    const cron = require('../lib/cron');

    // Schedule 3 deadlines, one for opening and one for closing,
    // and the 3rd one for closing position 2 weeks before Agora.
    // If there should be no deadline, cron will catch it.
    // Should be run on create and update.
    cron.addJob(cron.JOB_TYPES.OPEN_POSITION_APPLICATIONS, position.starts, { id: position.id });
    cron.addJob(cron.JOB_TYPES.CLOSE_POSITION_APPLICATIONS, position.ends, { id: position.id });
    cron.addJob(cron.JOB_TYPES.CLOSE_POSITION_APPLICATIONS, position.ends_force, { id: position.id, force: true });
});

module.exports = Position;
