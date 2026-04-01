import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "jsdom",

  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],

  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^next/server$": "<rootDir>/test/mocks/nextServer.ts"
  },

  transformIgnorePatterns: [
    "/node_modules/(?!next/)"
  ],

  testPathIgnorePatterns: ["/node_modules/", "/.next/"]
};

export default config;
