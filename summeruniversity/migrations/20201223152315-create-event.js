module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.createTable('events', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false
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
            photos: {
                type: Sequelize.ARRAY(Sequelize.STRING),
                allowNull: true
            },
            video: {
                type: Sequelize.STRING,
                allowNull: true
            },
            description: {
                type: Sequelize.TEXT,
                allowNull: false
            },
            email: {
                type: Sequelize.STRING,
                allowNull: false
            },
            website: {
                type: Sequelize.STRING,
                allowNull: true
            },
            social_media: {
                type: Sequelize.ARRAY(Sequelize.STRING),
                allowNull: true
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
                type: Sequelize.DECIMAL,
                allowNull: false
            },
            optional_fee: {
                type: Sequelize.DECIMAL,
                allowNull: true
            },
            organizing_bodies: {
                type: Sequelize.JSONB,
                allowNull: false
            },
            cooperation: {
                type: Sequelize.JSONB,
                allowNull: true
            },
            locations: {
                type: Sequelize.JSONB,
                allowNull: false
            },
            type: {
                type: Sequelize.STRING,
                allowNull: false
            },
            theme_category: {
                type: Sequelize.STRING,
                allowNull: false
            },
            theme: {
                type: Sequelize.TEXT,
                allowNull: false
            },
            theme_implementation: {
                type: Sequelize.TEXT,
                allowNull: false
            },
            learning_objectives: {
                type: Sequelize.ARRAY(Sequelize.STRING),
                allowNull: true
            },
            status: {
                // TODO: check with SUCT which statuses are possible
                type: Sequelize.STRING,
                allowNull: false
            },
            deleted: {
                type: Sequelize.BOOLEAN,
                allowNull: false
            },
            organizers: {
                type: Sequelize.JSONB,
                allowNull: false
            },
            trainers: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            questions: {
                type: Sequelize.JSONB,
                allowNull: true
            },
            pax_description: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            pax_confirmation: {
                type: Sequelize.STRING,
                allowNull: true
            },
            max_participants: {
                type: Sequelize.INTEGER,
                allowNull: true
            },
            budget: {
                type: Sequelize.STRING,
                allowNull: true
            },
            programme_suct: {
                type: Sequelize.STRING,
                allowNull: false
            },
            programme: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            activities_list: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            optional_programme: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            course_level: {
                type: Sequelize.STRING,
                allowNull: true
            },
            courses: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            accommodation_type: {
                type: Sequelize.STRING,
                allowNull: false
            },
            special_equipment: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            university_support: {
                type: Sequelize.BOOLEAN,
                allowNull: true
            },
            agreed_to_su_terms: {
                type: Sequelize.BOOLEAN,
                allowNull: false
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
