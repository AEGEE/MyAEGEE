module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('permissions', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER
        },
        scope: {
            type: Sequelize.STRING,
            allowNull: false
        },
        action: {
            type: Sequelize.STRING,
            allowNull: false
        },
        object: {
            type: Sequelize.STRING,
            allowNull: false
        },
        combined: {
            type: Sequelize.STRING,
            allowNull: false
        },
        description: {
            type: Sequelize.TEXT,
            allowNull: false
        },
        filters: {
            type: Sequelize.ARRAY(Sequelize.STRING),
            allowNull: false,
            defaultValue: []
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
    down: (queryInterface) => queryInterface.dropTable('permissions')
};
