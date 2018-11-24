const Event = require('./Event');
const Application = require('./Application');
const MembersList = require('./MembersList');
const PaxLimit = require('./PaxLimit');

Event.hasMany(Application);
Event.hasMany(MembersList);
Application.belongsTo(Event);
MembersList.belongsTo(Event);

module.exports = {
    Event,
    Application,
    MembersList,
    PaxLimit
};
