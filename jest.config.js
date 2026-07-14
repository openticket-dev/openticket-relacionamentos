// Setup de teste (jsdom + ts-jest + testing-library) — inspirado no
// openticket-eventos/jest.config.ts, em CommonJS pra dispensar ts-node.
// Cobre os fluxos criticos wireados ao gateway (/api/graphql): swipe/match,
// checkout premium (dinheiro), chat e lista de matches.
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react-jsx",
          esModuleInterop: true,
          module: "commonjs",
          moduleResolution: "node",
          verbatimModuleSyntax: false,
        },
      },
    ],
  },
  testMatch: ["<rootDir>/src/**/*.test.ts?(x)"],
};
