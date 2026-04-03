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
    "^server-only$": "<rootDir>/test/mocks/serverOnly.ts",
    // Force the CJS build of @google/genai so Jest (CommonJS runtime) can
    // require it without needing ESM transform support.
    "^@google/genai$": "<rootDir>/node_modules/@google/genai/dist/index.cjs"
  },

  // Allow ts-jest to transform ESM packages that Jest cannot execute natively.
  // @google/genai ships as ESM; it must be excluded from the ignore list so
  // ts-jest can transpile it to CommonJS for the test runner.
  transformIgnorePatterns: [
    "/node_modules/(?!next/|@google/genai/|p-retry/|@anthropic-ai/)"
  ],

  testPathIgnorePatterns: [
    "/node_modules/",
    "/.next/",
    "<rootDir>/tests/unit/.*\\.adapters\\.test\\.ts$",
  ]
};

export default config;
