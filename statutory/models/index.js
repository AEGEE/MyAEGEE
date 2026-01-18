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
const QuestionLine = require('./QuestionLine');
const Question = require('./Question');

Event.hasMany(Application, { foreignKey: 'event_id' });
Event.hasMany(MembersList, { foreignKey: 'event_id' });
Event.hasMany(VotesPerAntenna, { foreignKey: 'event_id' });
Event.hasMany(VotesPerDelegate, { foreignKey: 'event_id' });
Event.hasMany(Position, { foreignKey: 'event_id' });
Event.hasMany(Plenary, { foreignKey: 'event_id' });
Application.belongsTo(Event, { foreignKey: 'event_id' });
MembersList.belongsTo(Event, { foreignKey: 'event_id' });
VotesPerAntenna.belongsTo(Event, { foreignKey: 'event_id' });
VotesPerDelegate.belongsTo(Event, { foreignKey: 'event_id' });
Position.belongsTo(Event, { foreignKey: 'event_id' });
Plenary.belongsTo(Event, { foreignKey: 'event_id' });

Application.hasMany(VotesPerDelegate, { foreignKey: 'application_id' });
VotesPerDelegate.belongsTo(Application, { foreignKey: 'application_id' });

Position.hasMany(Candidate, { foreignKey: 'position_id' });
Candidate.belongsTo(Position, { foreignKey: 'position_id' });

Plenary.hasMany(Attendance, { foreignKey: 'plenary_id' });
Attendance.belongsTo(Plenary, { foreignKey: 'plenary_id' });

Application.hasMany(Attendance, { foreignKey: 'application_id' });
Attendance.belongsTo(Application, { foreignKey: 'application_id' });

Event.belongsTo(Image, { foreignKey: 'image_id' });
Image.hasOne(Event, { foreignKey: 'image_id' });

Candidate.belongsTo(Image, { foreignKey: 'image_id' });
Image.hasOne(Candidate, { foreignKey: 'image_id' });

Question.belongsTo(QuestionLine, { foreignKey: 'question_line_id' });
QuestionLine.hasMany(Question, { foreignKey: 'question_line_id' });

Application.hasMany(Question, { foreignKey: 'application_id' });
Question.belongsTo(Application, { foreignKey: 'application_id' });

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
    Attendance,
    QuestionLine,
    Question,
};
