import { defineConfig } from 'vitest/config';

// Testes de funções puras (regras e catálogo). Sem DOM: ambiente Node.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
