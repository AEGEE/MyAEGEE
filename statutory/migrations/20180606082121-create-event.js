
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('events', {
        id: {
            allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER
        },
        url: { type: Sequelize.STRING, allowNull: false, unique: true },
        name: { type: Sequelize.STRING, allowNull: false },
        starts: { type: Sequelize.DATE, allowNull: false },
        ends: { type: Sequelize.DATE, allowNull: false },
        description: { type: Sequelize.TEXT, allowNull: false },
        status: { type: Sequelize.ENUM('draft', 'published'), defaultValue: 'draft', allowNull: false },
        application_period_starts: { type: Sequelize.DATE, allowNull: false },
        application_period_ends: { type: Sequelize.DATE, allowNull: false },
        bodies: { type: Sequelize.ARRAY(Sequelize.INTEGER), allowNull: false },
        questions: { type: Sequelize.ARRAY(Sequelize.TEXT), allowNull: false },
        fee: { type: Sequelize.DECIMAL, allowNull: false },
        type: { type: Sequelize.ENUM('agora', 'epm'), allowNull: false },
        created_at: { allowNull: false, type: Sequelize.DATE },
        updated_at: { allowNull: false, type: Sequelize.DATE }
    }),
    down: queryInterface => queryInterface.dropTable('events')
};
