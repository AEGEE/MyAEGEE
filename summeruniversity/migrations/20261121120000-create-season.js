module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('seasons', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            year: {
                type: Sequelize.INTEGER,
                allowNull: false,
                unique: true
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false
            },
            active: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false
            },
            event_submission_deadline: {
                type: Sequelize.DATE,
                allowNull: true
            },
            application_period_starts: {
                type: Sequelize.DATE,
                allowNull: true
            },
            application_period_ends: {
                type: Sequelize.DATE,
                allowNull: true
            },
            created_at: {
                allowNull: false,
                type: Sequelize.DATE
            },
            updated_at: {
                allowNull: false,
                type: Sequelize.DATE
            }
        });

        // At most one season can be active at a time.
        await queryInterface.addIndex('seasons', ['active'], {
            name: 'seasons_single_active',
            unique: true,
            where: { active: true }
        });

        // The seasons that existing events use. 2026 was hardcoded before, so it stays active.
        const seasons = [2021, 2022, 2023, 2024, 2025, 2026].map((year) => ({
            year,
            name: 'Summer University ' + year,
            active: year === 2026,
            created_at: new Date(),
            updated_at: new Date()
        }));
        await queryInterface.bulkInsert('seasons', seasons);
    },
    down: async (queryInterface) => {
        await queryInterface.dropTable('seasons');
    }
};
