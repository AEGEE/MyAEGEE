module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn(
            'events',
            'booklet_folder',
            { type: Sequelize.STRING, allowNull: true }
        );

        await queryInterface.addColumn(
            'events',
            'draft_proposal_deadline',
            { type: Sequelize.DATE, allowNull: true }
        );

        await queryInterface.addColumn(
            'events',
            'final_proposal_deadline',
            { type: Sequelize.DATE, allowNull: true }
        );

        await queryInterface.addColumn(
            'events',
            'candidature_deadline',
            { type: Sequelize.DATE, allowNull: true }
        );

        await queryInterface.addColumn(
            'events',
            'booklet_publication_deadline',
            { type: Sequelize.DATE, allowNull: true }
        );

        await queryInterface.addColumn(
            'events',
            'updated_booklet_publication_deadline',
            { type: Sequelize.DATE, allowNull: true }
        );
    },
    down: async (queryInterface) => {
        await queryInterface.removeColumn(
            'events',
            'booklet_folder'
        );

        await queryInterface.removeColumn(
            'events',
            'draft_proposal_deadline'
        );

        await queryInterface.removeColumn(
            'events',
            'final_proposal_deadline'
        );

        await queryInterface.removeColumn(
            'events',
            'candidature_deadline'
        );

        await queryInterface.removeColumn(
            'events',
            'booklet_publication_deadline'
        );

        await queryInterface.removeColumn(
            'events',
            'updated_booklet_publication_deadline'
        );
    }
};
