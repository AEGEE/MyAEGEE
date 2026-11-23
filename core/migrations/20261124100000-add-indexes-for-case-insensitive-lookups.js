// Members are looked up by their lowercased email, username or Google Workspace account at
// every login and password reset, and by username in paths; bodies by their lowercased code.
// Without these indexes each lookup reads the whole table.
const INDEXES = [
    ['users', 'email'],
    ['users', 'username'],
    ['users', 'gsuite_id'],
    ['bodies', 'code']
];

module.exports = {
    up: async (queryInterface) => {
        for (const [table, column] of INDEXES) {
            await queryInterface.sequelize.query(`CREATE INDEX IF NOT EXISTS ${table}_lower_${column} ON ${table} (lower(${column}))`);
        }
    },
    down: async (queryInterface) => {
        for (const [table, column] of INDEXES) {
            await queryInterface.sequelize.query(`DROP INDEX IF EXISTS ${table}_lower_${column}`);
        }
    }
};
