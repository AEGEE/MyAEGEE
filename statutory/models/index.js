const Event = require('./Event');
const Application = require('./Application');
const MembersList = require('./MembersList');

Event.hasMany(Application);
Event.hasMany(MembersList);
Application.belongsTo(Event);
MembersList.belongsTo(Event);

module.exports = {
    Event,
    Application,
    MembersList
}
