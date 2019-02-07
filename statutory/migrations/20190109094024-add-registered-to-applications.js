module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.addColumn(
        'applications',
        'registered',
        { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false }
    ),
    down: queryInterface => queryInterface.removeColumn('applications', 'registered')
};
