module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.js"],
  moduleFileExtensions: ["js", "json", "node"],
  clearMocks: true,
  restoreMocks: true,
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/config/constants.js",
    "!src/server.js",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  testTimeout: 15000,
  verbose: true,
};
