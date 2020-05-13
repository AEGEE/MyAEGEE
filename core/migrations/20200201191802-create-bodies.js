module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('bodies', {
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
        email: {
            type: Sequelize.STRING,
            allowNull: true
        },
        phone: {
            type: Sequelize.STRING,
            allowNull: true
        },
        address: {
            type: Sequelize.TEXT,
            allowNull: true
        },
        type: {
            type: Sequelize.STRING,
            allowNull: false
        },
        pays_fees: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
        fee_currency: {
            type: Sequelize.STRING,
            allowNull: true
        },
        founded_at: {
            allowNull: false,
            type: Sequelize.DATEONLY,
            defaultValue: Sequelize.fn('NOW')
        },
        status: {
            allowNull: false,
            type: Sequelize.STRING,
            defaultValue: 'active'
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
    down: (queryInterface) => queryInterface.dropTable('bodies')
};
