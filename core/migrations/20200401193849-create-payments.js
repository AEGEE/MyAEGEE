module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('payments', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER
        },
        user_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        body_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: 'bodies',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        starts: {
            type: Sequelize.DATEONLY,
            allowNull: false,
        },
        expires: {
            type: Sequelize.DATEONLY,
            allowNull: false,
        },
        amount: {
            type: Sequelize.INTEGER,
            allowNull: false,
        },
        currency: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        comment: {
            type: Sequelize.TEXT,
            allowNull: true,
        },
        invoice_name: {
            type: Sequelize.TEXT,
            allowNull: true,
        },
        invoice_address: {
            type: Sequelize.TEXT,
            allowNull: true,
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
    down: (queryInterface) => queryInterface.dropTable('payments')
};
