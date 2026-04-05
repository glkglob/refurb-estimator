import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  detectOpenHandles: true,
  transform: {
    "^.+\\.(ts|tsx)$": "ts-jest"
  },

  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],

  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^next/server$": "<rootDir>/test/mocks/nextServer.ts",
    "^server-only$": "<rootDir>/test/mocks/serverOnly.ts"
  },

  transformIgnorePatterns: [
    "/node_modules/(?!next/)"
  ],

  testPathIgnorePatterns: [
    "/node_modules/",
    "/.next/",
    "<rootDir>/refurb-estimator/",
    "<rootDir>/tests/e2e/",
    "<rootDir>/tests/unit/.*\\.adapters\\.test\\.ts$",
  ]
};

export default config;
