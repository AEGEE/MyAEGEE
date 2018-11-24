module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn(
            'applications',
            'participant_order',
            Sequelize.INTEGER
        );

        await queryInterface.addIndex('applications', {
            fields: ['event_id', 'body_id', 'participant_type', 'participant_order'],
            type: 'unique',
            name: 'unique_participant_type_and_order'
        });

        await queryInterface.addIndex('applications', {
            fields: ['event_id', 'user_id'],
            type: 'unique',
            name: 'unique_participant_for_event'
        });
    },
    down: async (queryInterface) => {
        await queryInterface.removeColumn(
            'applications',
            'participant_order'
        );

        await queryInterface.removeIndex(
            'applications',
            'unique_participant_type_and_order'
        );

        await queryInterface.removeIndex(
            'applications',
            'unique_participant_for_event'
        );
    }
};
