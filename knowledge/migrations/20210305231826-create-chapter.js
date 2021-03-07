module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('chapters', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER
        },
        course_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: 'courses',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        name: {
            type: Sequelize.STRING,
            allowNull: false
        },
        description: {
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
    down: (queryInterface) => queryInterface.dropTable('chapters')
};
