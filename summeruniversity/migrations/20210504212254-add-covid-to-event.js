module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn(
            'events',
            'covid_regulations',
            { type: Sequelize.TEXT, allowNull: true }
        );

        await queryInterface.addColumn(
            'events',
            'fee_payment_date',
            { type: Sequelize.DATE, allowNull: true }
        );

        await queryInterface.addColumn(
            'events',
            'additional_regulation',
            { type: Sequelize.TEXT, allowNull: true }
        );
    },
    down: async (queryInterface) => {
        await queryInterface.removeColumn(
            'events',
            'covid_regulations'
        );

        await queryInterface.removeColumn(
            'events',
            'fee_payment_date'
        );

        await queryInterface.removeColumn(
            'events',
            'additional_regulation'
        );
    }
};
