module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.addColumn(
        'events',
        'memberslist_submission_deadline',
        Sequelize.DATE,
        { allowNull: true }
    ),
    down: queryInterface => queryInterface.removeColumn('events', 'memberslist_submission_deadline')
};
