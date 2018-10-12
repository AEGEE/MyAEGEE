module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('applications', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER
        },
        event_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references : {
                model : 'events',
                key   : 'id'
            }
        },
        user_id: {
            allowNull: false,
            type: Sequelize.INTEGER
        },
        body_id: {
            allowNull: false,
            type: Sequelize.INTEGER
        },
        visa_required: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        board_comment: {
            type: Sequelize.TEXT
        },
        answers: { type: Sequelize.ARRAY(Sequelize.TEXT), allowNull: false },
        participant_type: {
            type: Sequelize.ENUM('delegate', 'observer', 'envoy', 'visitor')
        },
        status: {
             type: Sequelize.ENUM('pending', 'accepted', 'rejected'),
             defaultValue: 'pending'
        },
        cancelled: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        paid_fee: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        attended: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false
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
    down: queryInterface => queryInterface.dropTable('applications')
};