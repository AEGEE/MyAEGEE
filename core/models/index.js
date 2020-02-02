const User = require('./User');
const Campaign = require('./Campaign');
const MailConfirmation = require('./MailConfirmation');
const AccessToken = require('./AccessToken');
const RefreshToken = require('./RefreshToken');
const Body = require('./Body');

Campaign.hasMany(User, { foreignKey: 'campaign_id' });
User.belongsTo(Campaign, { foreignKey: 'campaign_id' });

User.hasMany(MailConfirmation, { foreignKey: 'user_id' });
MailConfirmation.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(AccessToken, { foreignKey: 'user_id' });
AccessToken.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(RefreshToken, { foreignKey: 'user_id' });
RefreshToken.belongsTo(User, { foreignKey: 'user_id' });

module.exports = {
    User,
    Campaign,
    MailConfirmation,
    AccessToken,
    RefreshToken,
    Body
};
