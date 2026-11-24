const INDEX_NAME = 'attendances_one_open_per_plenary_and_application';

module.exports = {
    INDEX_NAME,
    // In one transaction: a duplicate added between the removal and the index cannot make
    // the migration stop halfway.
    up: (queryInterface) => queryInterface.sequelize.transaction(async (transaction) => {
        // A member has at most one open attendance at a plenary. Open duplicates (a member
        // marked twice at the same moment) are removed first, keeping the one that started
        // first (the lowest ID among those that started at the same moment): it covers the
        // time of the others, as all of them are still open. Closed attendances stay.
        await queryInterface.sequelize.query(`
            DELETE FROM attendances AS later
            USING attendances AS earlier
            WHERE later.ends IS NULL
                AND earlier.ends IS NULL
                AND later.plenary_id = earlier.plenary_id
                AND later.application_id = earlier.application_id
                AND (later.starts > earlier.starts OR (later.starts = earlier.starts AND later.id > earlier.id))
        `, { transaction });

        await queryInterface.addIndex('attendances', ['plenary_id', 'application_id'], {
            name: INDEX_NAME,
            unique: true,
            where: { ends: null },
            transaction
        });
    }),
    // The removed duplicates are not restored.
    down: (queryInterface) => queryInterface.removeIndex('attendances', INDEX_NAME)
};
