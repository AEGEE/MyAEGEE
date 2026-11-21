module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn(
            'boards',
            'new_board_email_sent_at',
            {
                type: Sequelize.DATE,
                allowNull: true
            }
        );

        // Existing boards that already started were handled by the old cron,
        // so mark them as sent to avoid emailing every historical board.
        await queryInterface.sequelize.query('UPDATE boards SET new_board_email_sent_at = NOW() WHERE start_date <= CURRENT_DATE');
    },
    down: (queryInterface) => queryInterface.removeColumn('boards', 'new_board_email_sent_at')
};
