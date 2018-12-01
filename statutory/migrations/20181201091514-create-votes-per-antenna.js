module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('votes_per_antenna', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER
        },
        event_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: 'events',
                key: 'id'
            },
            unique: 'votes_per_antenna_unique_for_body'
        },
        body_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            unique: 'votes_per_antenna_unique_for_body'
        },
        votes: {
            type: Sequelize.INTEGER,
            allowNull: false
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
    down: queryInterface => queryInterface.dropTable('votes_per_antenna')
};