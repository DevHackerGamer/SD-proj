/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',

  // Mocks for CSS modules and other CSS
  moduleNameMapper: {
    '\\.module\\.css$': 'identity-obj-proxy',
    '\\.css$': 'identity-obj-proxy',
  },

  // Use modern transform config — replaces deprecated `globals` config
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: './tsconfig.json',
        useESM: true,
      },
    ],
    '^.+\\.jsx?$': 'babel-jest',
  },

  // Jest setup
  setupFilesAfterEnv: ['<rootDir>/client/src/setupTests.ts'],
  moduleDirectories: ['node_modules', 'client/src'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],

  // Optional: add coverage settings if needed
  // collectCoverageFrom: ['client/src/**/*.{ts,tsx}', '!**/*.d.ts'],
  coverageDirectory: 'coverage',
};
