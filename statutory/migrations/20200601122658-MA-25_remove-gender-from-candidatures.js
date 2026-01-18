module.exports = {
    up: (queryInterface) => queryInterface.removeColumn('candidates', 'gender'),
    down: (queryInterface, Sequelize) => queryInterface.addColumn(
        'candidates',
        'gender',
        {
            type: Sequelize.STRING, allowNull: false, defaultValue: '',
        }
    )
};
