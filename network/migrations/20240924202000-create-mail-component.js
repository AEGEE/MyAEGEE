module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('mailComponent', {
        agora_id: {
            allowNull: false,
            type: Sequelize.INTEGER,
            primaryKey: true
        },
        mail_component: {
            allowNull: false,
            type: Sequelize.ENUM('introduction', 'communication', 'board election', 'members list', 'membership fee', 'events', 'agora attendance', 'development plan', 'fulfilment report', 'closing'),
            primaryKey: true
        },
        text: {
            allowNull: false,
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
    down: (queryInterface) => queryInterface.dropTable('mailComponent')
};
