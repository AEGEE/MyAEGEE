module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('join_requests', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER
        },
        body_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: 'bodies',
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
        motivation: {
            type: Sequelize.TEXT,
            allowNull: true
        },
        status: {
            allowNull: false,
            type: Sequelize.STRING,
            defaultValue: 'pending'
        },
        created_at: {
            allowNull: false,
            type: Sequelize.DATE
        },
        updated_at: {
            allowNull: false,
            type: Sequelize.DATE
        }
    }, {
        uniqueKeys: {
            body_permission_unique: {
                fields: ['body_id', 'user_id']
            }
        }
    }),
    down: (queryInterface) => queryInterface.dropTable('join_requests')
};
