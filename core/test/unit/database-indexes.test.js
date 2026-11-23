const { sequelize } = require('../../lib/sequelize');
const generator = require('../scripts/generator');

const indexesOf = async (table) => {
    const [rows] = await sequelize.query(
        'SELECT indexname, indexdef FROM pg_indexes WHERE tablename = :table',
        { replacements: { table } }
    );

    return Object.fromEntries(rows.map((row) => [row.indexname, row.indexdef]));
};

describe('Database indexes', () => {
    afterEach(async () => {
        await generator.clearAll();
    });

    // Logging in, password resets and the member in a path are found by the lowercased value.
    test.each(['email', 'username', 'gsuite_id'])('should have an index for looking up members by %s whatever the case', async (column) => {
        const indexes = await indexesOf('users');

        expect(indexes[`users_lower_${column}`]).toContain(`lower((${column})::text)`);
    });

    test('should have an index for looking up bodies by code whatever the case', async () => {
        const indexes = await indexesOf('bodies');

        expect(indexes.bodies_lower_code).toContain('lower((code)::text)');
    });

    test('should let two members have the same password hash', async () => {
        const first = await generator.createUser();
        const second = await generator.createUser();

        const [rows] = await sequelize.query('SELECT password FROM users WHERE id = :id', { replacements: { id: first.id } });
        await sequelize.query(
            'UPDATE users SET password = :password WHERE id = :id',
            { replacements: { password: rows[0].password, id: second.id } }
        );

        expect(Object.keys(await indexesOf('users'))).not.toContain('users_password_key');
    });
});
