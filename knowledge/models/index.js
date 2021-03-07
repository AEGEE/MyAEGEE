const Course = require('./Course');
const Chapter = require('./Chapter');
const Page = require('./Page');

Course.hasMany(Chapter, { foreignKey: 'course_id' });
Chapter.belongsTo(Course, { foreignKey: 'course_id' });

Chapter.hasMany(Page, { foreignKey: 'chapter_id' });
Page.belongsTo(Chapter, { foreignKey: 'chapter_id' });

module.exports = {
    Course,
    Chapter,
    Page
};
