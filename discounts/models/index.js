const Integration = require('./Integration');
const Code = require('./Code');

Integration.hasMany(Code);
Code.belongsTo(Integration);

module.exports = {
    Integration,
    Code
};
