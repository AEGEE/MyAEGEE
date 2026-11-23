module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.sequelize.transaction(async (transaction) => {
        // Safe to run again: columns that are already there are kept, with the changes that use them.
        const existingColumns = await queryInterface.describeTable('mail_changes', { transaction });
        const addColumn = async (name, definition) => {
            if (!existingColumns[name]) {
                await queryInterface.addColumn('mail_changes', name, definition, { transaction });
            }
        };

        // Changes that are pending were requested under the previous rules and are valid for
        // 48 hours at most. They are removed, the change has to be requested again.
        if (!existingColumns.old_email) {
            await queryInterface.sequelize.query('DELETE FROM mail_changes', { transaction });
        }

        // The token for the current address, if that address has to confirm the change as well.
        await addColumn('old_value', {
            type: Sequelize.TEXT,
            allowNull: true,
            unique: true
        });

        // The login address the change was requested for.
        await addColumn('old_email', {
            type: Sequelize.STRING,
            allowNull: false
        });

        await addColumn('new_confirmed_at', {
            type: Sequelize.DATE,
            allowNull: true
        });

        await addColumn('old_confirmed_at', {
            type: Sequelize.DATE,
            allowNull: true
        });

        // Who requested the change, if not the member themselves.
        await addColumn('requested_by', {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id'
            },
            onDelete: 'CASCADE'
        });
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
