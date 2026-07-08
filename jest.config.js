const preset = require('@twilio/flex-plugin-test').default();

module.exports = {
  ...preset,
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{spec,test}.{js,jsx,ts,tsx}',
    '<rootDir>/test/**/*.{spec,test}.{js,jsx,ts,tsx}',
  ],
};
