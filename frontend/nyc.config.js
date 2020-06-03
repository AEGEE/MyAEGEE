module.exports = {
  'check-coverage': false,
  'instrument': false,
  'sourceMap': false,
  'skip-empty': false,
  reporter: [
    'lcov',
    'text',
    'text-summary'
  ],
  include: ['src/**'],
  extension: [
    '.js',
    '.vue'
  ]
}
