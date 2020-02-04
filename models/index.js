const User = require('./User');
const Campaign = require('./Campaign');
const MailConfirmation = require('./MailConfirmation');
const AccessToken = require('./AccessToken');
const RefreshToken = require('./RefreshToken');
const Body = require('./Body');
const Circle = require('./Circle');
const Permission = require('./Permission');
const CirclePermission = require('./CirclePermission');
const CircleMembership = require('./CircleMembership');

Campaign.hasMany(User, { foreignKey: 'campaign_id' });
User.belongsTo(Campaign, { foreignKey: 'campaign_id' });

User.hasMany(MailConfirmation, { foreignKey: 'user_id' });
MailConfirmation.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(AccessToken, { foreignKey: 'user_id' });
AccessToken.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(RefreshToken, { foreignKey: 'user_id' });
RefreshToken.belongsTo(User, { foreignKey: 'user_id' });

Body.hasMany(Circle, { foreignKey: 'body_id' });
Circle.belongsTo(Body, { foreignKey: 'body_id' });

Circle.hasMany(Circle, { foreignKey: 'parent_circle_id', as: 'child_circles' });
Circle.belongsTo(Circle, { foreignKey: 'parent_circle_id', as: 'parent_circle' });

Circle.belongsToMany(Permission, { through: CirclePermission, foreignKey: 'circle_id', as: 'permissions' });
Permission.belongsToMany(Circle, { through: CirclePermission, foreignKey: 'permission_id', as: 'circles' });

Circle.belongsToMany(User, { through: CircleMembership, foreignKey: 'circle_id', as: 'users' });
User.belongsToMany(Circle, { through: CircleMembership, foreignKey: 'user_id', as: 'circles' });

CircleMembership.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(CircleMembership, { foreignKey: 'user_id' });

CircleMembership.belongsTo(Circle, { foreignKey: 'circle_id' });
Circle.hasMany(CircleMembership, { foreignKey: 'circle_id' });

module.exports = {
    User,
    Campaign,
    MailConfirmation,
    AccessToken,
    RefreshToken,
    Body,
    Circle,
    Permission,
    CirclePermission,
    CircleMembership
};
