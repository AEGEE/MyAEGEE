const Event = require('./Event');
const Application = require('./Application');


Event.hasMany(Application);
Application.belongsTo(Event);

module.exports = {
    Event,
    Application
}