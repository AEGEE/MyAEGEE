module.exports = {
    up: async (queryInterface) => {
        await queryInterface.removeConstraint(
            'pax_limits',
            'pax_limits_body_id_key'
        );

        await queryInterface.addConstraint(
            'pax_limits',
            {
                type: 'unique',
                name: 'pax_limits_body_id_event_type_unique',
                fields: ['body_id', 'event_type']
            }
        );
    },
    down: async (queryInterface) => {
        await queryInterface.removeConstraint(
            'pax_limits',
            'pax_limits_body_id_event_type_unique'
        );

        await queryInterface.addConstraint(
            'pax_limits',
            {
                type: 'unique',
                name: 'pax_limits_body_id_key',
                fields: ['body_id'],
            }
        );
    }
};
