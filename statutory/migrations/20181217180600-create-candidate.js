'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('candidates', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER
        },
        first_name: {
            type: Sequelize.STRING,
            allowNull: false
        },
        last_name: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        date_of_birth: {
            type: Sequelize.DATE,
            allowNull: false
        },
        gender: {
            type: Sequelize.STRING,
            allowNull: false
        },
        nationality: {
            type: Sequelize.STRING,
            allowNull: false
        },
        position_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: 'positions',
                key: 'id'
            },
        },
        body_name: {
            type: Sequelize.STRING,
            allowNull: false
        },
        languages: {
            type: Sequelize.ARRAY(Sequelize.STRING),
            allowNull: false
        },
        studies: {
            type: Sequelize.STRING,
            allowNull: false
        },
        member_since: {
            type: Sequelize.DATE,
            allowNull: false
        },
        european_experience: {
            type: Sequelize.TEXT,
            allowNull: false
        },
        local_experience: {
            type: Sequelize.TEXT,
            allowNull: false
        },
        attended_agorae: {
            type: Sequelize.TEXT,
            allowNull: false
        },
        attended_epm: {
            type: Sequelize.TEXT,
            allowNull: false
        },
        attended_conferences: {
            type: Sequelize.TEXT,
            allowNull: false
        },
        external_experience: {
            type: Sequelize.TEXT,
            allowNull: false
        },
        motivation: {
            type: Sequelize.TEXT,
            allowNull: false
        },
        program: {
            type: Sequelize.TEXT,
            allowNull: false
        },
        related_experience: {
            type: Sequelize.TEXT,
            allowNull: false
        },
        status: {
            type: Sequelize.ENUM('approved', 'rejected', 'pending'),
            allowNull: false,
            defaultValue: 'pending'
        },
        created_at: {
            allowNull: false,
            type: Sequelize.DATE
        },
        updated_at: {
            allowNull: false,
            type: Sequelize.DATE
        }
    }),
    down: queryInterface => queryInterface.dropTable('candidates')
};