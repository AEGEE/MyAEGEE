module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.addColumn(
        'candidates',
        'image_id',
        {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: 'images',
                key: 'id'
            }
        }
    ),
    down: queryInterface => queryInterface.removeColumn('candidates', 'image_id')
};
