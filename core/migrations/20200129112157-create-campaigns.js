module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('campaigns', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER
        },
        name: {
            type: Sequelize.STRING,
            allowNull: false
        },
        url: {
            type: Sequelize.STRING,
            allowNull: false,
            unique: true
        },
        active: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            default: true
        },
        description_short: {
            type: Sequelize.TEXT,
            allowNull: false
        },
        description_long: {
            type: Sequelize.TEXT,
            allowNull: false
        },
        activate_user: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            default: false
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
    down: (queryInterface) => {
        return queryInterface.dropTable('campaigns');
    }
};
