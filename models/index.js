const User = require('./User');
const Campaign = require('./Campaign');
const MailConfirmation = require('./MailConfirmation');

Campaign.hasMany(User, { foreignKey: 'campaign_id' });
User.belongsTo(Campaign, { foreignKey: 'campaign_id' });

User.hasMany(MailConfirmation, { foreignKey: 'user_id' });
MailConfirmation.belongsTo(User, { foreignKey: 'user_id' });

module.exports = {
    User,
    Campaign,
    MailConfirmation
};
