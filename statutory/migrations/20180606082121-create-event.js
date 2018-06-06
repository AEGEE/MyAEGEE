
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('events', {
        id: {
            allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER
        },
        name: { type: Sequelize.STRING, allowNull: false },
        starts: { type: Sequelize.DATE, allowNull: false },
        ends: { type: Sequelize.DATE, allowNull: false },
        description: { type: Sequelize.TEXT, allowNull: false },
        status: { type: Sequelize.ENUM('draft', 'requesting', 'approved'), defaultValue: 'draft', allowNull: false },
        application_period_starts: { type: Sequelize.DATE, allowNull: false },
        application_period_ends: { type: Sequelize.DATE, allowNull: false },
        locals: { type: Sequelize.ARRAY(Sequelize.INTEGER), allowNull: false },
        fee: { type: Sequelize.DECIMAL, allowNull: false },
        type: { type: Sequelize.ENUM('agora', 'epm'), allowNull: false },
        created_at: { allowNull: false, type: Sequelize.DATE },
        updated_at: { allowNull: false, type: Sequelize.DATE }
    }),
    down: queryInterface => queryInterface.dropTable('events')
};
