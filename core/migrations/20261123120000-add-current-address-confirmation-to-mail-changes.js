module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.sequelize.transaction(async (transaction) => {
        // Changes that are pending were requested under the previous rules and are valid for
        // 48 hours at most. They are removed, the change has to be requested again.
        await queryInterface.sequelize.query('DELETE FROM mail_changes', { transaction });

        // The token for the current address, if that address has to confirm the change as well.
        await queryInterface.addColumn('mail_changes', 'old_value', {
            type: Sequelize.TEXT,
            allowNull: true,
            unique: true
        }, { transaction });

        // The login address the change was requested for.
        await queryInterface.addColumn('mail_changes', 'old_email', {
            type: Sequelize.STRING,
            allowNull: false
        }, { transaction });

        await queryInterface.addColumn('mail_changes', 'new_confirmed_at', {
            type: Sequelize.DATE,
            allowNull: true
        }, { transaction });

        await queryInterface.addColumn('mail_changes', 'old_confirmed_at', {
            type: Sequelize.DATE,
            allowNull: true
        }, { transaction });

        // Who requested the change, if not the member themselves.
        await queryInterface.addColumn('mail_changes', 'requested_by', {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id'
            },
            onDelete: 'CASCADE'
        }, { transaction });
    }),
    down: (queryInterface) => queryInterface.sequelize.transaction(async (transaction) => {
        // Without the columns, nothing tells which addresses have to confirm a pending change.
        await queryInterface.sequelize.query('DELETE FROM mail_changes', { transaction });

        await queryInterface.removeColumn('mail_changes', 'requested_by', { transaction });
        await queryInterface.removeColumn('mail_changes', 'old_confirmed_at', { transaction });
        await queryInterface.removeColumn('mail_changes', 'new_confirmed_at', { transaction });
        await queryInterface.removeColumn('mail_changes', 'old_email', { transaction });
        await queryInterface.removeColumn('mail_changes', 'old_value', { transaction });
    })
};
