module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('pax_limits', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER
        },
        delegate: {
            type: Sequelize.INTEGER
        },
        envoy: {
            type: Sequelize.INTEGER
        },
        observer: {
            type: Sequelize.INTEGER
        },
        visitor: {
            type: Sequelize.INTEGER
        },
        body_id: {
            allowNull: false,
            type: Sequelize.INTEGER,
            unique: true
        },
        created_at: {
            allowNull: false,
            type: Sequelize.DATE
        },
        updated_at: {
            allowNull: false,
            type: Sequelize.DATE
        },
        event_type: {
            type: Sequelize.ENUM('agora', 'epm'),
            allowNull: false
        },
    }),
    down: queryInterface => queryInterface.dropTable('pax_limits')
};
