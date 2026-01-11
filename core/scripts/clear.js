const { authenticate, close } = require('../lib/sequelize');
const logger = require('../lib/logger');
const {
    User,
    Body,
    Circle,
    Permission,
    CircleMembership,
    CirclePermission,
    BodyMembership,
    Campaign,
    Payment,
    MailChange,
    JoinRequest,
    AccessToken,
    RefreshToken,
    MailConfirmation
} = require('../models');

if (process.env.NODE_ENV === 'production') {
    logger.error('Not clearing db in production.');
    process.exit(0);
}

authenticate().then(async () => {
    logger.info('[clear         ]: DB connected');

    await MailChange.destroy({ where: {}, truncate: { cascade: true } });
    await Payment.destroy({ where: {}, truncate: { cascade: true } });
    await JoinRequest.destroy({ where: {}, truncate: { cascade: true } });
    await BodyMembership.destroy({ where: {}, truncate: { cascade: true } });
    await Permission.destroy({ where: {}, truncate: { cascade: true } });
    await CirclePermission.destroy({ where: {}, truncate: { cascade: true } });
    await CircleMembership.destroy({ where: {}, truncate: { cascade: true } });
    await Circle.destroy({ where: {}, truncate: { cascade: true } });
    await Body.destroy({ where: {}, truncate: { cascade: true } });
    await AccessToken.destroy({ where: {}, truncate: { cascade: true } });
    await RefreshToken.destroy({ where: {}, truncate: { cascade: true } });
    await MailConfirmation.destroy({ where: {}, truncate: { cascade: true } });
    await User.destroy({ where: {}, truncate: { cascade: true } });
    await Campaign.destroy({ where: {}, truncate: { cascade: true } });

    await close();
}).catch((err) => {
    logger.error(`[clear         ]: DB clearing error: ${err}`);
    process.exit(1);
});
