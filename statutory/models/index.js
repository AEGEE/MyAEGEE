const moment = require('moment');

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

// A date as a client writes it: a day (2031-07-01) or a full timestamp with its time zone
// (2031-07-01T10:00:00.000Z). Anything else that JavaScript would read as some date
// ("1", "2031", a number) is not a date here.
const WRITTEN_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2}))?$/;
const isWrittenAsDate = (value) => typeof value === 'string' && WRITTEN_DATE.test(value) && moment(value).isValid();
const isEmpty = (value) => value === null || value === undefined || value === '';

// A setter for a date column: a date as a client writes it becomes a date, as it would
// without this setter, and so does a date object that the code itself sets. Any other
// value is kept as it is, for the validator below to refuse.
const setDate = (name, dateOnly) => function set(value) {
    if (isWrittenAsDate(value) || value instanceof Date || moment.isMoment(value)) {
        this.setDataValue(name, dateOnly ? moment(value).format('YYYY-MM-DD') : new Date(value));
    } else {
        this.setDataValue(name, value);
    }
};

// A validator for a date column. An empty value is left to the validators that say that
// the value should be set.
const isDate = (value) => {
    const valid = value instanceof Date ? !Number.isNaN(value.getTime()) : isWrittenAsDate(value);
    if (!isEmpty(value) && !valid) {
        throw new Error('The value should be a date, written as 2031-07-01 or as 2031-07-01T10:00:00.000Z.');
    }
};

// A validator for a text column: the value is a text. No value is left to the validators
// that say that the value should be set.
const isText = (value) => {
    if (value !== null && value !== undefined && typeof value !== 'string') {
        throw new Error('The value should be a text.');
    }
};

// A validator for a list of texts.
const isListOfTexts = (value) => {
    if (value !== null && value !== undefined && (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))) {
        throw new Error('The value should be a list of texts.');
    }
};

// A setter for a yes/no column that keeps the value as it was sent, for the validator below:
// without it, Sequelize would read "true", "1" or 1 as true.
const setAsSent = (name) => function set(value) {
    this.setDataValue(name, value);
};

// A validator for a yes/no column: the value is true or false. No value is left to the
// validators that say that the value should be set.
const isBoolean = (value) => {
    if (value !== null && value !== undefined && typeof value !== 'boolean') {
        throw new Error('The value should be true or false.');
    }
};

// A validator for a column that holds one value of a kind that text, a number or a list
// with one item all pass for (a choice out of a few, an amount): a list or an object is none.
const isOneValue = (value) => {
    if (value !== null && typeof value === 'object') {
        throw new Error('The value should be one value, not a list or an object.');
    }
};

// Every text, yes/no, whole number and date column refuses a value that does not fit it, with
// a validation error on the field. Without it such a value fails in the database, or is
// stored as something else than what was sent.
for (const model of models) {
    for (const [name, attribute] of Object.entries(model.rawAttributes)) {
        const length = getStringLength(attribute.type);
        const textValidator = attribute.type instanceof Sequelize.ARRAY ? isListOfTexts : isText;
        if (length) {
            attribute.validate = { isText: textValidator, ...attribute.validate, fitsInColumn: fitsInStringColumn(length) };
        } else if (attribute.type instanceof Sequelize.TEXT) {
            attribute.validate = { isText, ...attribute.validate };
        } else if (attribute.type instanceof Sequelize.BOOLEAN) {
            attribute.set = setAsSent(name);
            attribute.validate = { ...attribute.validate, isBoolean };
        } else if (attribute.type instanceof Sequelize.INTEGER) {
            attribute.validate = { ...attribute.validate, fitsInColumn: fitsInIntegerColumn };
        } else if (attribute.type instanceof Sequelize.DATE || attribute.type instanceof Sequelize.DATEONLY) {
            attribute.set = setDate(name, attribute.type instanceof Sequelize.DATEONLY);
            attribute.validate = { ...attribute.validate, isWrittenAsDate: isDate };
        } else if (attribute.type instanceof Sequelize.ENUM || attribute.type instanceof Sequelize.DECIMAL) {
            attribute.validate = { isOneValue, ...attribute.validate };
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
