const Event = require('./Event');
const Application = require('./Application');

Event.hasMany(Application, { foreignKey: 'event_id' });
Application.belongsTo(Event, { foreignKey: 'event_id' });

module.exports = {
    Event,
    Application
};
