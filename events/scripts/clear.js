const { authenticate, close } = require('../lib/sequelize');
const logger = require('../lib/logger');
const {
    Application,
    Event
} = require('../models');

if (process.env.NODE_ENV === 'production') {
    logger.error('Not clearing db in production.');
    process.exit(0);
}

authenticate().then(async () => {
    logger.info('[clear         ]: DB connected');

    await Application.destroy({ where: {}, truncate: { cascade: true } });
    await Event.destroy({ where: {}, truncate: { cascade: true } });

    await close();
}).catch((err) => {
    logger.error(`[clear         ]: DB clearing error: ${err}`);
    process.exit(1);
});
