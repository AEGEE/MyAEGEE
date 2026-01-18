module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('integrations', {
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
        code: {
            type: Sequelize.STRING,
            allowNull: false,
            unique: true
        },
        quota_period: {
            type: Sequelize.STRING,
            allowNull: false
        },
        quota_amount: {
            type: Sequelize.INTEGER,
            allowNull: false
        },
        description: {
            type: Sequelize.TEXT
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
    down: (queryInterface) => queryInterface.dropTable('integrations')
};
