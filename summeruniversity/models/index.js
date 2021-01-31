const Event = require('./Event');
const Year = require('./Year');

Year.hasMany(Event, { foreignKey: 'event_id' });
Event.belongsTo(Year, { foreignKey: 'event_id' });

module.exports = {
    Event,
    Year
};
