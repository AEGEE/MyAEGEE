module.exports = {
  up: (queryInterface, Sequelize) => {
      return queryInterface.createTable('votes_per_delegate', {
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
                unique: 'votes_per_delegate_unique_for_user'
            },
            application_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'applications',
                    key: 'id'
                }
            },
            type: {
                type: Sequelize.ENUM('on-event', 'off-event'),
                allowNull: false,
                unique: 'votes_per_delegate_unique_for_user'
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                unique: 'votes_per_delegate_unique_for_user'
            },
            body_id: {
                type: Sequelize.INTEGER,
                allowNull: false
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
        });
    },
    down: (queryInterface) => queryInterface.dropTable('votes_per_delegate')
};