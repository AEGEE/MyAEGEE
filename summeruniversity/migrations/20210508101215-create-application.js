module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.createTable('applications', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            event_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'events',
                    key: 'id'
                }
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            first_name: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            last_name: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            nationality: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            travelling_from: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            visa_required: {
                type: Sequelize.BOOLEAN,
                allowNull: false
            },
            visa_place_of_birth: {
                allowNull: true,
                type: Sequelize.STRING
            },
            visa_passport_number: {
                allowNull: true,
                type: Sequelize.STRING
            },
            visa_passport_issue_date: {
                allowNull: true,
                type: Sequelize.STRING
            },
            visa_passport_expiration_date: {
                allowNull: true,
                type: Sequelize.STRING
            },
            visa_passport_issue_authority: {
                allowNull: true,
                type: Sequelize.STRING
            },
            visa_embassy: {
                allowNull: true,
                type: Sequelize.STRING
            },
            visa_street_and_house: {
                allowNull: true,
                type: Sequelize.STRING
            },
            visa_postal_code: {
                allowNull: true,
                type: Sequelize.STRING
            },
            visa_city: {
                allowNull: true,
                type: Sequelize.STRING
            },
            visa_country: {
                allowNull: true,
                type: Sequelize.STRING
            },
            body_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            body_name: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            status: {
                type: Sequelize.ENUM('pending', 'accepted', 'rejected'),
                allowNull: false,
                defaultValue: 'pending'
            },
            confirmed: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false
            },
            attended: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false
            },
            cancelled: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false
            },
            board_comment: {
                type: Sequelize.TEXT
            },
            aegee_experience: {
                allowNull: false,
                type: Sequelize.TEXT
            },
            ideal_su: {
                allowNull: false,
                type: Sequelize.TEXT
            },
            motivation: {
                allowNull: false,
                type: Sequelize.TEXT
            },
            answers: {
                type: Sequelize.JSONB,
                allowNull: false,
                defaultValue: []
            },
            meals: {
                allowNull: false,
                type: Sequelize.STRING,
                defaultValue: '',
            },
            allergies: {
                allowNull: true,
                type: Sequelize.TEXT
            },
            agreed_to_privacy_policy: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false
            },
            agreed_to_su_terms: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false
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
        return queryInterface.dropTable('applications');
    }
};
