module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.createTable('applications', {
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
                }
            },
            first_name: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            last_name: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            body_name: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            body_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            status: {
                type: Sequelize.ENUM('pending', 'accepted', 'rejected'),
                allowNull: false,
                defaultValue: 'pending'
            },
            board_comment: {
                type: Sequelize.TEXT
            },
            answers: {
                type: Sequelize.JSONB,
                allowNull: false,
                defaultValue: []
            },
            created_at: {
                allowNull: false,
                type: Sequelize.DATE
            },
            updated_at: {
                allowNull: false,
                type: Sequelize.DATE
            }
        });
    },
    down: (queryInterface) => {
        return queryInterface.dropTable('Applications');
    }
};
