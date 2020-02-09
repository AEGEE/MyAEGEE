module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('circle_permissions', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER
        },
        circle_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: 'circles',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        permission_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: 'permissions',
                key: 'id'
            },
            onDelete: 'CASCADE'
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
    down: (queryInterface) => queryInterface.dropTable('circle_permissions')
};
