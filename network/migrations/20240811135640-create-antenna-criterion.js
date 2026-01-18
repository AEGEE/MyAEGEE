module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('antennaCriteria', {
        agora_id: {
            allowNull: false,
            type: Sequelize.INTEGER,
            primaryKey: true
        },
        body_id: {
            allowNull: false,
            type: Sequelize.INTEGER,
            primaryKey: true
        },
        antenna_criterion: {
            allowNull: false,
            type: Sequelize.ENUM('communication', 'board election', 'members list', 'membership fee', 'events', 'agora attendance', 'development plan', 'fulfilment report'),
            primaryKey: true
        },
        value: {
            allowNull: true,
            type: Sequelize.ENUM('true', 'false', 'exception')
        },
        comment: {
            allowNull: true,
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
    down: (queryInterface) => queryInterface.dropTable('antennaCriteria')
};
