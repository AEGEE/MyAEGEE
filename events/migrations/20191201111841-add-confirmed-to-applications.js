module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.addColumn(
        'applications',
        'confirmed',
        { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false }
    ),
    down: (queryInterface) => queryInterface.removeColumn('applications', 'confirmed')
};
