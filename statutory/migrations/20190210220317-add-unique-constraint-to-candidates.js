module.exports = {
  up: async (queryInterface) => {
      await queryInterface.addConstraint(
          'candidates',
          ['position_id', 'user_id'],
          { type: 'unique', name: 'candidates_position_id_user_id_unique' }
      );
  },
  down: async (queryInterface) => {
      await queryInterface.removeConstraint(
          'candidates',
          'candidates_position_id_user_id_unique'
      );
  }
};
