const moment = require('moment');

const { sequelize } = require('../../lib/sequelize');
const generator = require('../scripts/generator');
const migration = require('../../migrations/20261124120000-add-one-open-attendance-per-plenary');

// The migration removes the open attendances that a member has twice or more at a plenary,
// keeping the one that started first, and then allows only one open attendance.
describe('Migration: one open attendance per member and plenary', () => {
    const queryInterface = sequelize.getQueryInterface();

    afterEach(async () => {
        await generator.clearAll();
    });

    afterAll(async () => {
        await sequelize.close();
    });

    const attendances = async () => {
        const [rows] = await sequelize.query('SELECT id, plenary_id, application_id, starts, ends FROM attendances ORDER BY id');
        return rows;
    };

    test('keeps the first open attendance of each member, and every closed one', async () => {
        await migration.down(queryInterface);

        const event = await generator.createEvent({ type: 'agora', applications: [] });
        const plenary = await generator.createPlenary({}, event);
        const first = await generator.createApplication({}, event);
        const second = await generator.createApplication({}, event);

        const at = (minutes) => moment('2031-07-01T10:00:00Z').add(minutes, 'minutes').toDate();
        const create = (application, starts, ends) => generator.createAttendance({ application_id: application.id, starts, ends }, plenary);

        const kept = await create(first, at(0), null);
        await create(first, at(5), null);
        await create(first, at(0), null);
        const closed = await create(first, at(-30), at(-20));
        const other = await create(second, at(10), null);

        await migration.up(queryInterface);

        expect((await attendances()).map((row) => row.id)).toEqual([kept.id, closed.id, other.id]);

        await expect(create(first, at(15), null)).rejects.toThrow();
        await expect(create(first, at(15), at(16))).resolves.toBeTruthy();
    });
});
