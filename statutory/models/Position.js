const moment = require('moment');

const { Sequelize, sequelize } = require('../lib/sequelize');

const Position = sequelize.define('Position', {
    name: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Position name should be set.' },
        }
    },
    description: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Position decription should be set.' },
        }
    },
    starts: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Event start date should be set.' },
            isDate: { msg: 'Event start date should be valid.' }
        }
    },
    ends: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: '',
        validate: {
            notEmpty: { msg: 'Event end date should be set.' },
            isDate: { msg: 'Event end date should be valid.' },
            laterThanStart(val) {
                if (moment(val).isSameOrBefore(this.starts)) {
                    throw new Error('Event cannot start after or at the same time it ends.');
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
}, { underscored: true, tableName: 'positions' });

Position.beforeSave((position) => {
    // If the position.starts (application period starts) is not set and is later
    // than the current time, then it's planned for the future. If so, we set
    // the status to closed and then planning a cron task to open it on the deadline.
    // Else, if it's not set, that means we want to open the application
    // period right now. So, position.starts should be the current time.
    // TODO: Implement the cron task to do it.
    if (position.starts && moment(position.starts).isSameOrBefore(moment())) {
        position.status = 'closed';
    } else if (!position.starts) {
        position.starts = new Date();
    }
});

Position.prototype.openDeadline = async function openDeadline(deadline) {
    return await this.update({ status: 'open', ends: deadline });
};

module.exports = Position;

