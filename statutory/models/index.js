const Event = require('./Event');
const Question = require('./Question');

Event.hasMany(Question);
Question.belongsTo(Event);

module.exports = {
    Event,
    Question
}