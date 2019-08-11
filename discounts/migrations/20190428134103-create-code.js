module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('codes', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER
        },
        integration_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: 'integrations',
                key: 'id'
            }
        },
        value: {
            allowNull: false,
            type: Sequelize.STRING
        },
        claimed_by: {
            type: Sequelize.INTEGER
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
    down: (queryInterface) => queryInterface.dropTable('codes')
};
