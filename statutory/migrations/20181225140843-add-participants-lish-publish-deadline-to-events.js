'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => queryInterface.addColumn(
      'events',
      'participants_list_publish_deadline',
      Sequelize.DATE,
      { allowNull: false, defaultValue: Sequelize.fn('NOW') }
  ),
  down: (queryInterface, Sequelize) => queryInterface.removeColumn('events', 'participants_list_publish_deadline')
};