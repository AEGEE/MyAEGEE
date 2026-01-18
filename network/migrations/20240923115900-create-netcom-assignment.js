module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('netcom', {
        body_id: {
            allowNull: false,
            type: Sequelize.INTEGER,
            primaryKey: true
        },
        netcom_id: {
            allowNull: false,
            type: Sequelize.INTEGER
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
    down: (queryInterface) => queryInterface.dropTable('netcom')
};
