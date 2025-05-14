// jest.config.cjs (CommonJS style)
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '\\.module\\.css$': '<rootDir>/client/src/_mock_/styleMock.js', // Match .module.css
    '\\.css$': 'identity-obj-proxy', // Match all other .css files
  },
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  setupFilesAfterEnv: ['<rootDir>/client/src/setupTests.ts'],
};