// Inserts the content the hardcoded page had, so it looks the same after deploying.
const RESOURCES = [
    {
        name: 'Stay informed',
        theme: 'blue',
        links: [
            { url: 'https://aegee.org', title: 'AEGEE Website', description: 'Official website' },
            {
                url: 'https://b1905f52.sibforms.com/serve/MUIFABZ7dW0Hjpw5BjnfaUUf6FWO5WAeoUit48zO0eIA0YAnT6pErXmLyKqTMrfjXDeTMd62E75ggVEsalSQtxGIpUjI2sO3gdjeO8pn-LRorgvcwJIyJNPYLq0HyxqRmpu3UtQaySzFxxaDXtr2cNwJiiXW-jafJVI90kqeUa0vh4t2n-SJTKx8BSoKqcNVLE_UOIO7ch1PAfVhXA==',
                title: 'Internal Newsletter',
                description: 'Monthly internal newsletter, for all our members.'
            },
            { url: 'https://www.zeus.aegee.org/magazine/', title: 'The AEGEEan Magazine', description: 'AEGEE\'s online magazine' },
            { url: 'https://drive.google.com/drive/folders/1kU6DQd0v5rsGMwdjnhYUerYcJMH7af0_', title: 'Key to Europe', description: 'Yearbook: the annual report publication' },
            { url: '/pages/mailing-lists', title: 'Mailing Lists', description: 'AEGEE mailing lists' },
            { url: 'https://www.facebook.com/groups/aegeeans/', title: 'Facebook Group', description: 'AEGEE\'s official group on Facebook' }
        ]
    },
    {
        name: 'Safety and conduct',
        theme: 'purple',
        links: [
            { url: 'https://www.aegee.org/code-of-conduct/', title: 'Code of Conduct', description: 'Read AEGEE\'s Code of Conduct' },
            {
                url: 'https://docs.google.com/forms/d/e/1FAIpQLSf0OmluW11nce72VEuWOybQ1n83gMK6UcE9QvfJ5gIBETUwpA/viewform',
                title: 'Code of Conduct Violation Report',
                description: 'Report a case of Code of Conduct violation'
            },
            { url: 'https://forms.gle/EcaDkdyQfSb65Jdh8', title: 'Safe Person Committee', description: 'Request a Safe Person or workshop for your event' }
        ]
    },
    {
        name: 'Statutory and strategy',
        theme: 'yellow',
        links: [
            { url: 'https://www.zeus.aegee.org/statutoryvote/jc/', title: 'Online Voting', description: 'Online voting for Agorae and the General Assembly' },
            { url: 'https://drive.google.com/drive/folders/1GKd6jWeolMDRw7EXZO-ROXupBQUzAgk2', title: 'CIA', description: 'Statutes, regulations, working formats and motions' },
            { url: 'https://drive.google.com/drive/folders/1TSLKDPKUFe7k3POjlW1XzJdxgz5mfhrQ', title: 'Strategic Plans & Action Agendas', description: 'Strategic Plans and their Action Agendas' }
        ]
    },
    {
        name: 'Network',
        theme: 'green',
        links: [
            {
                url: 'https://docs.google.com/forms/d/e/1FAIpQLSd2u-r1jFGyNwYCwsSnMf9-dApH7ZGeGltZusxqWqkB_VQ0zg/viewform',
                title: 'AEGEE Contact in your City',
                description: 'Leave your details to start founding an AEGEE Contact in your city'
            },
            {
                url: 'https://docs.google.com/forms/d/e/1FAIpQLSfmbGAjG_us00KMuV-pMeasja_gfjLXVwhaqRK9y5rbTSb0xw/viewform',
                title: 'Suggest a City for a Contact',
                description: 'Suggest where AEGEE should have a Contact'
            },
            { url: 'https://docs.google.com/document/d/1rQRddt8H3J1RUYMpdxRxuhNqyV3BcP8mV8ykNLNup3o/edit', title: 'Set up your own Contact', description: 'Find out how to set up a Contact in this step-by-step guide' },
            { url: 'https://docs.google.com/document/d/1e0jdTLvn7-JdwOlxMXcf55I5mcNwEmI_loN0djj0U2c/edit', title: 'Develop your Contact', description: 'Tips and tricks to develop your Contact, in one toolkit' }
        ]
    },
    {
        name: 'Financial',
        theme: 'blue-dark',
        links: [
            { url: 'https://form.jotform.com/261133028599056', title: 'ASRF Application Form', description: 'Apply for the AEGEE Social Responsibility Fund' },
            { url: 'https://form.jotform.com/92653241656965', title: 'Reimbursement Form', description: 'Request a reimbursement for AEGEE-Europe\'s expenses' },
            { url: 'https://form.jotform.com/261146144461047', title: 'Travel Plan of European Bodies', description: 'Request travel plan approval on behalf of your European Body' }
        ]
    },
    {
        name: 'Requests',
        theme: 'red',
        links: [
            { url: 'https://forms.gle/DhfVStza9xhn1jRT6', title: 'AEGEE-Academy', description: 'Request a trainer for your training events' },
            { url: 'https://forms.gle/s8vE6b9wrEHqV1xe9', title: 'AEGEE House Guest Request', description: 'Visiting the AEGEE house' }
        ]
    },
    {
        name: 'Brand and PR',
        theme: 'grey',
        links: [
            { url: 'https://myaegee.atlassian.net/wiki/spaces/KMS/pages/2238152708/Public+Relations', title: 'Visual Identity', description: 'Manual, logos, PR materials and more' }
        ]
    }
];

const timestamps = (Sequelize) => ({
    created_at: {
        allowNull: false,
        type: Sequelize.DATE
    },
    updated_at: {
        allowNull: false,
        type: Sequelize.DATE
    }
});

module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.sequelize.transaction(async (transaction) => {
        await queryInterface.createTable('resource_categories', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            name: {
                allowNull: false,
                type: Sequelize.STRING(100)
            },
            theme: {
                allowNull: false,
                type: Sequelize.STRING
            },
            position: {
                allowNull: false,
                type: Sequelize.INTEGER
            },
            ...timestamps(Sequelize)
        }, { transaction });

        await queryInterface.createTable('resource_links', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            category_id: {
                allowNull: false,
                type: Sequelize.INTEGER,
                references: {
                    model: 'resource_categories',
                    key: 'id'
                },
                onDelete: 'RESTRICT'
            },
            title: {
                allowNull: false,
                type: Sequelize.STRING(100)
            },
            description: {
                allowNull: false,
                type: Sequelize.STRING(255)
            },
            url: {
                allowNull: false,
                type: Sequelize.STRING(2048)
            },
            position: {
                allowNull: false,
                type: Sequelize.INTEGER
            },
            ...timestamps(Sequelize)
        }, { transaction });

        await queryInterface.addIndex('resource_links', ['category_id'], { transaction });

        const now = new Date();
        for (const [categoryPosition, category] of RESOURCES.entries()) {
            const [[{ id }]] = await queryInterface.sequelize.query(
                'INSERT INTO resource_categories (name, theme, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?) RETURNING id',
                { replacements: [category.name, category.theme, categoryPosition, now, now], transaction }
            );

            await queryInterface.bulkInsert('resource_links', category.links.map((link, linkPosition) => ({
                category_id: id,
                title: link.title,
                description: link.description,
                url: link.url,
                position: linkPosition,
                created_at: now,
                updated_at: now
            })), { transaction });
        }
    }),
    down: (queryInterface) => queryInterface.sequelize.transaction(async (transaction) => {
        await queryInterface.dropTable('resource_links', { transaction });
        await queryInterface.dropTable('resource_categories', { transaction });
    })
};
