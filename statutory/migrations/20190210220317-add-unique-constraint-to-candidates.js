module.exports = {
    up: async (queryInterface) => {
        await queryInterface.addConstraint(
            'candidates',
            {
                type: 'unique',
                name: 'candidates_position_id_user_id_unique',
                fields: ['position_id', 'user_id'],
            }
        );
    },
    down: async (queryInterface) => {
        await queryInterface.removeConstraint(
            'candidates',
            'candidates_position_id_user_id_unique'
        );
    }
};
