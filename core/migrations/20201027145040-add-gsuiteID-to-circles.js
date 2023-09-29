module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.addColumn(
        'circles',
        'gsuite_id',
        {
            type: Sequelize.STRING,
            allowNull: true,
            unique: true
        },
    ),
    down: (queryInterface) => queryInterface.removeColumn('circles', 'gsuite_id')
};
