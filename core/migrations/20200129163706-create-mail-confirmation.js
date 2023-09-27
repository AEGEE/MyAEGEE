module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('mail_confirmations', {
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
            },
            onDelete: 'CASCADE'
        },
        value: {
            type: Sequelize.TEXT,
            allowNull: false,
            unique: true
        },
        expires_at: {
            allowNull: false,
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
    down: (queryInterface) => {
        return queryInterface.dropTable('mail_confirmations');
    }
};
