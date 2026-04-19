const db = require('../lib/sequelize');

afterAll(async () => {
    if (db.sequelize) {
        await db.close();
    }
});
