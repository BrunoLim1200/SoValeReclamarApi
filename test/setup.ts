// Os handlers logam erros com console.error nos blocos catch. Nos testes de caminho
// de erro isso polui a saída do Jest sem agregar valor, então silenciamos por padrão.
// Os testes ainda podem inspecionar as chamadas via o spy exportado, se necessário.
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  (console.error as jest.Mock).mockRestore?.();
});
