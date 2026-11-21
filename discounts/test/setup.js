const db = require('../lib/sequelize');

// Close the PostgreSQL connection after each test file so jest can exit on its own.
afterAll(async () => {
    await db.close();
});
