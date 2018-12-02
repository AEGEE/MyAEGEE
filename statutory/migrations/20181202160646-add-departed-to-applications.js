module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.addColumn(
        'applications',
        'departed',
        Sequelize.BOOLEAN
    ),
    down: (queryInterface, Sequelize) => queryInterface.removeColumn('applications', 'departed')
};
