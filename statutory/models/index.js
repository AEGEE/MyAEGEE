const Event = require('./Event');
const Application = require('./Application');
const MembersList = require('./MembersList');
const PaxLimit = require('./PaxLimit');
const VotesPerAntenna = require('./VotesPerAntenna');

Event.hasMany(Application);
Event.hasMany(MembersList);
Event.hasMany(VotesPerAntenna);
Application.belongsTo(Event);
MembersList.belongsTo(Event);
VotesPerAntenna.belongsTo(Event);


module.exports = {
    Event,
    Application,
    MembersList,
    PaxLimit,
    VotesPerAntenna
};
