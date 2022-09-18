module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('boards', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER
        },
        body_id: {
            type: Sequelize.INTEGER,
            allowNull: false
        },
        elected_date: {
            type: Sequelize.DATEONLY,
            allowNull: false
        },
        start_date: {
            type: Sequelize.DATEONLY,
            allowNull: false
        },
        end_date: {
            type: Sequelize.DATEONLY,
            allowNull: true
        },
        president: {
            type: Sequelize.INTEGER,
            allowNull: false
        },
        secretary: {
            type: Sequelize.INTEGER,
            allowNull: false
        },
        treasurer: {
            type: Sequelize.INTEGER,
            allowNull: false
        },
        other_members: {
            type: Sequelize.JSONB,
            allowNull: true
        },
        message: {
            type: Sequelize.TEXT,
            allowNull: true
        },
        image_id: {
            type: Sequelize.INTEGER,
            allowNull: true
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
    down: (queryInterface) => queryInterface.dropTable('boards')
};
