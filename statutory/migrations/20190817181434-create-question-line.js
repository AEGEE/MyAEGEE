module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('question_lines', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER
        },
        event_id: {
            allowNull: false,
            type: Sequelize.INTEGER,
            references: {
                model: 'events',
                key: 'id'
            },
        },
        name: {
            type: Sequelize.STRING,
            allowNull: false
        },
        status: {
            type: Sequelize.ENUM('open', 'closed'),
            defaultValue: 'closed',
            allowNull: false,
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
    down: queryInterface => queryInterface.dropTable('question_lines')
};
