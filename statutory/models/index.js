const Event = require('./Event');
const Application = require('./Application');
const MembersList = require('./MembersList');
const PaxLimit = require('./PaxLimit');
const VotesPerAntenna = require('./VotesPerAntenna');
const VotesPerDelegate = require('./VotesPerDelegate');
const Position = require('./Position');

Event.hasMany(Application);
Event.hasMany(MembersList);
Event.hasMany(VotesPerAntenna);
Event.hasMany(VotesPerDelegate);
Event.hasMany(Position);
Application.belongsTo(Event);
MembersList.belongsTo(Event);
VotesPerAntenna.belongsTo(Event);
VotesPerDelegate.belongsTo(Event);
Position.belongsTo(Event);

Application.hasMany(VotesPerDelegate);
VotesPerDelegate.belongsTo(Application);

module.exports = {
    Event,
    Application,
    MembersList,
    PaxLimit,
    VotesPerAntenna,
    VotesPerDelegate,
    Position
};
