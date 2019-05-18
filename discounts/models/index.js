const Integration = require('./Integration');
const Code = require('./Code');
const Category = require('./Category');

Integration.hasMany(Code);
Code.belongsTo(Integration);

module.exports = {
    Integration,
    Code,
    Category
};
