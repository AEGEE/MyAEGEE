module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.createTable('years', {
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
            starts: {
                type: Sequelize.DATE,
                allowNull: false
            },
            ends: {
                type: Sequelize.DATE,
                allowNull: false
            },
            opening_submission: {
                type: Sequelize.DATE,
                allowNull: false
            },
            end_first_submission: {
                type: Sequelize.DATE,
                allowNull: false
            },
            end_second_submission: {
                type: Sequelize.DATE,
                allowNull: false
            },
            publish_su: {
                type: Sequelize.DATE,
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
    down: (queryInterface) => {
        return queryInterface.dropTable('years');
    }
};
