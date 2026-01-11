module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('body_memberships', {
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
        comment: {
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
    }, {
        uniqueKeys: {
            circle_permission_unique: {
                fields: ['body_id', 'user_id']
            }
        }
    }),
    down: (queryInterface) => queryInterface.dropTable('body_memberships')
};
