module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js', '**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/'],
  verbose: true,
  testTimeout: 30000, // 30 seconds for property tests
  collectCoverageFrom: [
    'lib/**/*.js',
    '!lib/**/*.test.js'
  ]
};
