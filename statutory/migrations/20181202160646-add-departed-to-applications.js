module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.addColumn(
        'applications',
        'departed',
        Sequelize.BOOLEAN
    ),
    down: queryInterface => queryInterface.removeColumn('applications', 'departed')
};
