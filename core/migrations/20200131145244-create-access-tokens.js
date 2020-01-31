module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('access_tokens', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER
        },
        user_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        value: {
            type: Sequelize.TEXT,
            allowNull: false
        },
        created_at: {
            allowNull: false,
            type: Sequelize.DATE
        },
        updated_at: {
            allowNull: false,
            type: Sequelize.DATE
        },
        expires_at: {
            allowNull: false,
            type: Sequelize.DATE
        },
    }),
    down: (queryInterface) => queryInterface.dropTable('access_tokens')
};
