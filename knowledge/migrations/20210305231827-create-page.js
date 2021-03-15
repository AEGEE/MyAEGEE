module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('pages', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER
        },
        chapter_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: 'chapters',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        name: {
            type: Sequelize.STRING,
            allowNull: false
        },
        content_type: {
            type: Sequelize.STRING
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
