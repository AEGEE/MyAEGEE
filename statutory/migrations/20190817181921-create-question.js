module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('questions', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER
        },
        question_line_id: {
            allowNull: false,
            type: Sequelize.INTEGER,
            references: {
                model: 'question_lines',
                key: 'id'
            },
        },
        application_id: {
            allowNull: false,
            type: Sequelize.INTEGER,
            references: {
                model: 'applications',
                key: 'id'
            },
        },
        text: {
            type: Sequelize.TEXT,
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
    down: queryInterface => queryInterface.dropTable('questions')
};
