module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('circles', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER
        },
        name: {
            type: Sequelize.STRING,
            allowNull: false
        },
        description: {
            type: Sequelize.TEXT,
            allowNull: false
        },
        joinable: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        body_id: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: 'bodies',
                key: 'id'
            },
            onDelete: 'SET NULL'
        },
        parent_circle_id: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: 'circles',
                key: 'id'
            },
            onDelete: 'SET NULL'
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
    down: (queryInterface) => queryInterface.dropTable('circles')
};
