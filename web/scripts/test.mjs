import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, mode: 'test' });
try {
  await server.ssrLoadModule('/src/utils/sorting.test.ts');
  await server.ssrLoadModule('/src/hooks/useExpenses.test.ts');
} finally {
  await server.close();
}
