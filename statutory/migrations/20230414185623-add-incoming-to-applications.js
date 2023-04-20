module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.addColumn(
        'applications',
        'incoming',
        { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: false }
    ),
    down: (queryInterface) => queryInterface.removeColumn('applications', 'incoming')
};
