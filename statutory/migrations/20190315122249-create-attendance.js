module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('attendances', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER
        },
        application_id: {
            allowNull: false,
            type: Sequelize.INTEGER,
            references: {
                model: 'applications',
                key: 'id'
            },
        },
        plenary_id: {
            allowNull: false,
            type: Sequelize.INTEGER,
            references: {
                model: 'plenaries',
                key: 'id'
            },
        },
        starts: {
            allowNull: false,
            type: Sequelize.DATE
        },
        ends: {
            type: Sequelize.DATE
        },
        created_at: {
            allowNull: false,
            type: Sequelize.DATE
        },
        updated_at: {
            allowNull: false,
            type: Sequelize.DATE
        }
    }),
    down: queryInterface => queryInterface.dropTable('attendances')
};
