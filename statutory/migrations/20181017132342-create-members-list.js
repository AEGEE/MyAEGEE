'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => queryInterface.createTable('memberslists', {
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
      },
      unique: 'memberslist_unique_event_body'
    },
    user_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    body_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      unique: 'memberslist_unique_event_body'
    },
    members: {
      type: Sequelize.JSONB,
      allowNull: false,
    },
    currency: {
      type: Sequelize.STRING,
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
  }),
  down: queryInterface => queryInterface.dropTable('memberslists')
};
