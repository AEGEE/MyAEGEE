module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('questions', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER
        },
        event_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references : {
                model : "events",
                key   : "id"
            }
        },
        description: {
            allowNull: false,
            type: Sequelize.TEXT
        },
        required: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: true
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