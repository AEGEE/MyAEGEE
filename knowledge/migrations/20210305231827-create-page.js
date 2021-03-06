module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('pages', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER
        },
        category_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: 'categories',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        name: {
            type: Sequelize.STRING,
            allowNull: false
        },
        content_type: {
            type: Sequelize.STRING,
            allowNull: false
        },
        content: {
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
    down: (queryInterface) => queryInterface.dropTable('pages')
};
