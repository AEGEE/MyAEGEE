module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('users', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER
        },
        username: {
            type: Sequelize.STRING,
            allowNull: false,
            unique: true
        },
        email: {
            type: Sequelize.STRING,
            allowNull: false,
            unique: true
        },
        password: {
            type: Sequelize.STRING,
            allowNull: false,
            unique: true
        },
        mail_confirmed_at: {
            type: Sequelize.DATE,
            allowNull: true
        },
        active: {
            type: Sequelize.BOOLEAN,
            allowNull: true,
            defaultValue: true
        },
        superadmin: {
            type: Sequelize.BOOLEAN,
            allowNull: true,
            defaultValue: false
        },
        first_name: {
            type: Sequelize.STRING,
            allowNull: false
        },
        last_name: {
            type: Sequelize.STRING,
            allowNull: false
        },
        date_of_birth: {
            type: Sequelize.DATEONLY,
            allowNull: true
        },
        gender: {
            type: Sequelize.STRING,
            allowNull: true
        },
        phone: {
            type: Sequelize.STRING,
            allowNull: true
        },
        address: {
            type: Sequelize.TEXT,
            allowNull: true
        },
        about_me: {
            type: Sequelize.TEXT,
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
    down: (queryInterface) => {
        return queryInterface.dropTable('users');
    }
};
