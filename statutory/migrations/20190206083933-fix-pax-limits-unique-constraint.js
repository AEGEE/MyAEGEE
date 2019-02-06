module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.removeConstraint(
      'pax_limits',
      'pax_limits_body_id_key'
    );

    await queryInterface.addConstraint(
      'pax_limits',
      ['body_id', 'event_type'],
      { type: 'unique', name: 'pax_limits_body_id_event_type_unique' }
    );
  },
  down: async (queryInterface) => {
    await queryInterface.removeConstraint(
      'pax_limits',
      'pax_limits_body_id_event_type_unique'
    );

    await queryInterface.addConstraint(
      'pax_limits',
      ['body_id'],
      { type: 'unique', name: 'pax_limits_body_id_key' }
    );
  }
};
