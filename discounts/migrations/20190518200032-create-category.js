module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('categories', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER
        },
        name: {
            allowNull: false,
            type: Sequelize.STRING
        },
        discounts: {
            allowNull: false,
            type: Sequelize.JSONB
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
    down: (queryInterface) => queryInterface.dropTable('categories')
};
