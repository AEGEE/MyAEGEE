const Integration = require('./Integration');
const Code = require('./Code');
const Category = require('./Category');

Integration.hasMany(Code, { foreignKey: 'integration_id' });
Code.belongsTo(Integration, { foreignKey: 'integration_id' });

module.exports = {
    Integration,
    Code,
    Category
};
