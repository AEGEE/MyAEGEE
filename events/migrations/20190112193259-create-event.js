module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.createTable('events', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            url: {
                type: Sequelize.STRING,
                allowNull: true,
                unique: true
            },
            image: {
                type: Sequelize.STRING,
                allowNull: true
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false
            },
            description: {
                type: Sequelize.TEXT,
                allowNull: false
            },
            application_starts: {
                type: Sequelize.DATE,
                allowNull: false
            },
            application_ends: {
                type: Sequelize.DATE,
                allowNull: false
            },
            starts: {
                type: Sequelize.DATE,
                allowNull: false
            },
            ends: {
                type: Sequelize.DATE,
                allowNull: false
            },
            fee: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            organizing_bodies: {
                type: Sequelize.JSONB,
                allowNull: false
            },
            locations: {
                type: Sequelize.JSONB,
                allowNull: false
            },
            type: {
                type: Sequelize.ENUM('wu', 'es', 'nwm', 'ltc', 'rtc', 'local', 'other'),
                allowNull: false
            },
            status: {
                type: Sequelize.ENUM('draft', 'requesting', 'published'),
                defaultValue: 'draft',
                allowNull: false
            },
            deleted: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false
            },
            organizers: {
                type: Sequelize.JSONB,
                allowNull: false
            },
            questions: {
                type: Sequelize.JSONB,
                allowNull: false
            },
            max_participants: {
                type: Sequelize.INTEGER,
                allowNull: true,
                defaultValue: null
            },
            created_at: {
                allowNull: false,
                type: Sequelize.DATE
            },
            updated_at: {
                allowNull: false,
                type: Sequelize.DATE
            }
        });
    },
    down: (queryInterface) => {
        return queryInterface.dropTable('Events');
    }
};
