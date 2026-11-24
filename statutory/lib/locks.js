const config = require('../config');
const { sequelize } = require('./sequelize');

// Limits how long the queries of this transaction wait for a lock: a waiting request holds
// a database connection, so it gives up after postgres.lock_timeout instead.
exports.limitLockWait = (transaction) => sequelize.query(
    `SET LOCAL lock_timeout = ${Number(config.postgres.lock_timeout)}`,
    { transaction }
);

// Postgres answers lock_not_available (55P03) when the lock timeout runs out.
exports.isLockTimeout = (err) => Boolean(err.parent && err.parent.code === '55P03');
