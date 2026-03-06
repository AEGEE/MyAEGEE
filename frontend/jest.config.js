module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/tests/unit/**/*.spec.js'],
  moduleFileExtensions: ['js', 'json', 'vue'],
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    '^assets/(.*)$': '<rootDir>/src/assets/$1',
    '^components/(.*)$': '<rootDir>/src/components/$1',
    '^views/(.*)$': '<rootDir>/src/views/$1',
    '^vuex-store$': '<rootDir>/src/store',
    '\\.(css|scss|sass)$': '<rootDir>/tests/unit/styleMock.js'
  },
  transform: {
    '^.+\\.vue$': '@vue/vue2-jest',
    '^.+\\.js$': 'babel-jest'
  },
  setupFilesAfterEnv: ['<rootDir>/tests/unit/setup.js']
}
