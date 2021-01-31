const models = require('./models');
const { Sequelize, sequelize, authenticate } = require('./lib/sequelize');

global.authenticate = authenticate;
global.Sequelize = Sequelize;
global.sequelize = sequelize;

for (const key in models) {
    global[key] = models[key]; // importing models as global
}

authenticate().catch((err) => {
    /* eslint-disable-next-line no-console */
    console.error('Error connecting to DB:', err.message);
    process.quit(1);
});
