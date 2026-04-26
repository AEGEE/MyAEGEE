module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('event_application_bans', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER
        },
        user_id: {
            allowNull: false,
            type: Sequelize.INTEGER,
            references: {
                model: 'users',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        banned_by_user_id: {
            allowNull: false,
            type: Sequelize.INTEGER,
            references: {
                model: 'users',
                key: 'id'
            },
            onDelete: 'RESTRICT'
        },
        ban_until: {
            allowNull: false,
            type: Sequelize.DATE
        },
        lifted_by_user_id: {
            allowNull: true,
            type: Sequelize.INTEGER,
            references: {
                model: 'users',
                key: 'id'
            },
            onDelete: 'SET NULL'
        },
        lifted_at: {
            allowNull: true,
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
    down: (queryInterface) => queryInterface.dropTable('event_application_bans')
};
