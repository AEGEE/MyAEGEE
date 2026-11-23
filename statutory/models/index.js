const { Sequelize } = require('../lib/sequelize');
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

const models = [
    Event,
    Application,
    MembersList,
    PaxLimit,
    VotesPerAntenna,
    VotesPerDelegate,
    Position,
    Candidate,
    Plenary,
    Attendance,
    Image,
    QuestionLine,
    Question
];

// The length of a string column (255 unless the model says otherwise), also for the
// items of an array of strings. Undefined for every other column, long texts included.
const getStringLength = (type) => {
    if (type instanceof Sequelize.ARRAY) {
        return getStringLength(type.type);
    }

    // eslint-disable-next-line no-underscore-dangle
    return type instanceof Sequelize.STRING ? type._length : undefined;
};

// What a whole number column holds.
const MIN_INTEGER = -2147483648;
const MAX_INTEGER = 2147483647;

// A validator for a string column: the value is not longer than the column.
const fitsInStringColumn = (length) => (value) => {
    const values = Array.isArray(value) ? value : [value];
    if (values.some((item) => typeof item === 'string' && item.length > length)) {
        throw new Error(`The value should be at most ${length} characters long.`);
    }
};

// A validator for a whole number column: the value is a whole number that the column holds.
// No value, or an empty text, is left to the validators that say that the value should be set.
const fitsInIntegerColumn = (value) => {
    if (value === null || value === undefined || value === '') {
        return;
    }

    const number = ['number', 'string'].includes(typeof value) ? Number(value) : NaN;
    if (!Number.isInteger(number) || number < MIN_INTEGER || number > MAX_INTEGER) {
        throw new Error(`The value should be a whole number between ${MIN_INTEGER} and ${MAX_INTEGER}.`);
    }
};

// Every string and whole number column refuses a value that does not fit it, with a
// validation error on the field. Without it such a value fails in the database.
for (const model of models) {
    for (const attribute of Object.values(model.rawAttributes)) {
        const length = getStringLength(attribute.type);
        if (length) {
            attribute.validate = { ...attribute.validate, fitsInColumn: fitsInStringColumn(length) };
        } else if (attribute.type instanceof Sequelize.INTEGER) {
            attribute.validate = { ...attribute.validate, fitsInColumn: fitsInIntegerColumn };
        }
    }

    model.refreshAttributes();
}

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
