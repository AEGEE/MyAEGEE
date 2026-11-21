module.exports = {
    up: (queryInterface) => queryInterface.addIndex('applications', {
        fields: ['event_id', 'statutory_id'],
        type: 'unique',
        name: 'unique_statutory_id_for_event'
    }),
    down: (queryInterface) => queryInterface.removeIndex('applications', 'unique_statutory_id_for_event')
};
