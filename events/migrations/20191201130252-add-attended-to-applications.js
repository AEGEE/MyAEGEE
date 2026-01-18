module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.addColumn(
        'applications',
        'attended',
        { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false }
    ),
    down: (queryInterface) => queryInterface.removeColumn('applications', 'attended')
};
