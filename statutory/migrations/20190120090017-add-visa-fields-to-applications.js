const visaFields = [
  'visa_place_of_birth',
  'visa_passport_number',
  'visa_passport_issue_date',
  'visa_passport_expiration_date',
  'visa_passport_issue_authority',
  'visa_nationality',
  'visa_embassy'
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
