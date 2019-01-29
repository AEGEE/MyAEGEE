const visaFields = [
  'visa_place_of_birth',
  'visa_passport_number',
  'visa_passport_issue_date',
  'visa_passport_expiration_date',
  'visa_passport_issue_authority',
  'nationality',
  'visa_embassy',
  'date_of_birth',
  'visa_street_and_house',
  'visa_postal_code',
  'visa_city',
  'visa_country'
]

module.exports = {
  up: async (queryInterface, Sequelize) => {
    for (const field of visaFields) {
      await queryInterface.addColumn(
        'applications',
        field,
        { type: Sequelize.STRING, allowNull: true }
      );
    }
  },
  down: async (queryInterface, Sequelize) => {
    for (const field of visaFields) {
      await queryInterface.removeColumn(
        'applications',
        field,
        { type: Sequelize.STRING, allowNull: true }
      );
    }
  }
};
