const Event = require('./Event');
const Application = require('./Application');
const MembersList = require('./MembersList');
const PaxLimit = require('./PaxLimit');
const VotesPerAntenna = require('./VotesPerAntenna');
const VotesPerDelegate = require('./VotesPerDelegate');

Event.hasMany(Application);
Event.hasMany(MembersList);
Event.hasMany(VotesPerAntenna);
Event.hasMany(VotesPerDelegate);
Application.belongsTo(Event);
MembersList.belongsTo(Event);
VotesPerAntenna.belongsTo(Event);
VotesPerDelegate.belongsTo(Event);

Application.hasMany(VotesPerDelegate);
VotesPerDelegate.belongsTo(Application);

module.exports = {
    Event,
    Application,
    MembersList,
    PaxLimit,
    VotesPerAntenna,
    VotesPerDelegate
};
