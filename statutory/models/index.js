const Event = require('./Event');
const Application = require('./Application');
const MembersList = require('./MembersList');
const PaxLimit = require('./PaxLimit');
const VotesPerAntenna = require('./VotesPerAntenna');
const VotesPerDelegate = require('./VotesPerDelegate');
const Position = require('./Position');
const Candidate = require('./Candidate');
const Plenary = require('./Plenary');
const Attendance = require('./Attendance');
const Image = require('./Image');

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

Plenary.hasMany(Attendance);
Attendance.belongsTo(Plenary);

Application.hasMany(Attendance);
Attendance.belongsTo(Application);

Event.belongsTo(Image);
Image.hasOne(Event);

Candidate.belongsTo(Image);
Image.hasOne(Candidate);

module.exports = {
    Event,
    Image,
    Application,
    MembersList,
    PaxLimit,
    VotesPerAntenna,
    VotesPerDelegate,
    Position,
    Candidate,
    Plenary,
    Attendance
};
