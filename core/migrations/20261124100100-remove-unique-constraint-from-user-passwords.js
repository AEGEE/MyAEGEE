// The users table was created with a unique constraint on the password hash. Nothing relies
// on it, and the model does not have it.
module.exports = {
    up: (queryInterface) => queryInterface.sequelize.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_password_key'),
    down: (queryInterface) => queryInterface.sequelize.query('ALTER TABLE users ADD CONSTRAINT users_password_key UNIQUE (password)')
};
