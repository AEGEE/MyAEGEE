module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('images', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER
        },
        user_id: {
            type: Sequelize.INTEGER,
            allowNull: false
        },
        file_name: {
            type: Sequelize.STRING,
            allowNull: false
        },
        file_folder: {
            type: Sequelize.STRING,
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
    down: queryInterface => queryInterface.dropTable('images')
};
