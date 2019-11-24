module.exports = {
  up: (queryInterface) => queryInterface.renameColumn('applications', 'paid_fee', 'confirmed'),
  down: queryInterface => queryInterface.removeColumn('applications', 'confirmed', 'paid_fee')
};
