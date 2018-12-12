module.exports = {
  up: (queryInterface, Sequelize) => queryInterface.createTable('positions', {
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
        },
        name: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        description: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        deadline: {
            type: Sequelize.DATE,
            allowNull: false,
        },
        places: {
            type: Sequelize.INTEGER,
            allowNull: false,
        },
        status: {
            type: Sequelize.ENUM('open', 'open_manually', 'closed'),
            defaultValue: 'open',
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
  down: queryInterface => queryInterface.dropTable('positions')
};
