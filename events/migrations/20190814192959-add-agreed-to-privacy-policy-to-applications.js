module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.addColumn(
        'applications',
        'agreed_to_privacy_policy',
        { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false }
    ),
    down: queryInterface => queryInterface.removeColumn('applications', 'agreed_to_privacy_policy')
};
