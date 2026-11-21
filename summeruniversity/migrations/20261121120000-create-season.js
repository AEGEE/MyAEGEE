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

        // The season that was hardcoded before, so the behaviour stays the same.
        await queryInterface.bulkInsert('seasons', [{
            year: 2026,
            name: 'Summer University 2026',
            active: true,
            created_at: new Date(),
            updated_at: new Date()
        }]);
    },
    down: async (queryInterface) => {
        await queryInterface.dropTable('seasons');
    }
};
