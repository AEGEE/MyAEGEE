const Event = require('./Event');
const Application = require('./Application');
const MembersList = require('./MembersList');
const PaxLimit = require('./PaxLimit');
const VotesPerAntenna = require('./VotesPerAntenna');
const VotesPerDelegate = require('./VotesPerDelegate');
const Position = require('./Position');
const Candidate = require('./Candidate');
const Plenary = require('./Plenary');

Event.hasMany(Application);
Event.hasMany(MembersList);
Event.hasMany(VotesPerAntenna);
Event.hasMany(VotesPerDelegate);
Event.hasMany(Position);
Event.hasMany(Plenary);
Application.belongsTo(Event);
MembersList.belongsTo(Event);
VotesPerAntenna.belongsTo(Event);
VotesPerDelegate.belongsTo(Event);
Position.belongsTo(Event);
Plenary.belongsTo(Event);

Application.hasMany(VotesPerDelegate);
VotesPerDelegate.belongsTo(Application);

Position.hasMany(Candidate);
Candidate.belongsTo(Position);

module.exports = {
    Event,
    Application,
    MembersList,
    PaxLimit,
    VotesPerAntenna,
    VotesPerDelegate,
    Position,
    Candidate,
    Plenary
};
