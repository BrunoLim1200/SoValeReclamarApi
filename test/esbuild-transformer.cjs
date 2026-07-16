// Jest transformer que compila TypeScript usando o esbuild (já instalado como
// dependência do serverless-esbuild). Evita adicionar ts-jest/babel só para os testes
// e mantém a mesma stack de bundling usada no deploy.
const esbuild = require('esbuild');

module.exports = {
  process(source, filename) {
    const loader = filename.endsWith('.tsx') ? 'tsx' : 'ts';
    const result = esbuild.transformSync(source, {
      loader,
      format: 'cjs',
      target: 'es2022',
      sourcemap: 'inline',
      sourcefile: filename,
    });
    return { code: result.code };
  },
};
