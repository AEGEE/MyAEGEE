const config = require('../config');
const { sequelize } = require('./sequelize');

// Limits how long the queries of this transaction wait for a lock: a waiting request holds
// a database connection, so it gives up after postgres.lock_timeout instead.
exports.limitLockWait = (transaction) => sequelize.query(
    `SET LOCAL lock_timeout = ${Number(config.postgres.lock_timeout)}`,
    { transaction }
);

// A transaction whose waits for locks (rows it changes, the locks it takes) are limited from
// its first query on.
exports.transaction = (work) => sequelize.transaction(async (t) => {
    await exports.limitLockWait(t);
    return work(t);
});

// Postgres answers lock_not_available (55P03) when the lock timeout runs out, and
// deadlock_detected (40P01) when it ends a wait that would never end. Either way the
// transaction was rolled back and nothing was changed.
exports.isLockTimeout = (err) => Boolean(err.parent && ['55P03', '40P01'].includes(err.parent.code));
