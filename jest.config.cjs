/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.[tj]sx?$': '<rootDir>/test/esbuild-transformer.cjs',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  clearMocks: true,
  // Silencia os console.error dos blocos catch dos handlers durante os testes de erro.
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  collectCoverageFrom: [
    'src/functions/**/*.ts',
    // db/index.ts só abre a conexão postgres (sem lógica testável) e schema.ts é
    // declaração de tabelas — ambos ficam fora da métrica de cobertura.
    '!src/db/**',
  ],
};
