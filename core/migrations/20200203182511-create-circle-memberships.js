module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('circle_memberships', {
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
        user_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        position: {
            type: Sequelize.TEXT,
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
    }),
    down: (queryInterface) => queryInterface.dropTable('circle_memberships')
};
