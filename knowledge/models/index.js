const Course = require('./Course');
const Category = require('./Category');
const Page = require('./Page');

Course.hasMany(Category, { foreignKey: 'course_id' });
Category.belongsTo(Course, { foreignKey: 'course_id' });

Category.hasMany(Page, { foreignKey: 'category_id' });
Page.belongsTo(Category, { foreignKey: 'category_id' });

module.exports = {
    Course,
    Category,
    Page
};
