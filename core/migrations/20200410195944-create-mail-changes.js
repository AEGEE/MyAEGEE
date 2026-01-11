module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('mail_changes', {
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
        new_email: {
            type: Sequelize.STRING,
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
    down: (queryInterface) => queryInterface.dropTable('mail_changes')
};
