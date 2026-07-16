import { createDbMock } from '../../helpers/dbMock';
import { buildEvent } from '../../helpers/event';

const mock = createDbMock();
jest.mock('../../../src/db', () => ({ db: mock.db }));

const { handler } = require('../../../src/functions/feed/list') as {
  handler: (event: any) => Promise<{ statusCode: number; body: string }>;
};

beforeEach(() => mock.reset());

// O feed usa limit=10 fixo; hasMore é verdadeiro quando exatamente 10 itens voltam.
const tenRows = Array.from({ length: 10 }, (_, i) => ({ id: `c${i}` }));

describe('GET /feed', () => {
  it('usa page=1 e offset=0 por padrão', async () => {
    mock.queueResult([]);

    const res = await handler(buildEvent({ queryStringParameters: null }));
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.metadata.currentPage).toBe(1);
    expect(mock.lastCall('offset')?.args[0]).toBe(0);
    expect(mock.lastCall('limit')?.args[0]).toBe(10);
  });

  it('calcula o offset a partir do parâmetro page (page=3 -> offset=20)', async () => {
    mock.queueResult([]);

    await handler(buildEvent({ queryStringParameters: { page: '3' } }));

    expect(mock.lastCall('offset')?.args[0]).toBe(20);
  });

  it('marca hasMore=true e nextPage quando retorna a página cheia (10 itens)', async () => {
    mock.queueResult(tenRows);

    const res = await handler(buildEvent({ queryStringParameters: { page: '2' } }));
    const { metadata } = JSON.parse(res.body);

    expect(metadata.hasMore).toBe(true);
    expect(metadata.nextPage).toBe(3);
  });

  it('marca hasMore=false e nextPage=null quando a página não está cheia', async () => {
    mock.queueResult(tenRows.slice(0, 4));

    const res = await handler(buildEvent({ queryStringParameters: { page: '1' } }));
    const { data, metadata } = JSON.parse(res.body);

    expect(data).toHaveLength(4);
    expect(metadata.hasMore).toBe(false);
    expect(metadata.nextPage).toBeNull();
  });

  it('retorna 500 quando o banco falha', async () => {
    mock.queueError(new Error('db error'));

    const res = await handler(buildEvent({ queryStringParameters: null }));

    expect(res.statusCode).toBe(500);
  });

  describe('sanitização do parâmetro page', () => {
    it('trata page não-numérica como página 1 (offset 0)', async () => {
      mock.queueResult([]);

      const res = await handler(buildEvent({ queryStringParameters: { page: 'abc' } }));
      const { metadata } = JSON.parse(res.body);

      expect(metadata.currentPage).toBe(1);
      expect(mock.lastCall('offset')?.args[0]).toBe(0);
    });

    it.each([
      ['zero', '0'],
      ['negativa', '-5'],
    ])('trata page %s como página 1 (offset 0, sem offset negativo)', async (_label, page) => {
      mock.queueResult([]);

      const res = await handler(buildEvent({ queryStringParameters: { page } }));
      const { metadata } = JSON.parse(res.body);

      expect(metadata.currentPage).toBe(1);
      expect(mock.lastCall('offset')?.args[0]).toBe(0);
    });

    it('mantém uma page válida > 1 (page=3 -> offset 20)', async () => {
      mock.queueResult([]);

      const res = await handler(buildEvent({ queryStringParameters: { page: '3' } }));
      const { metadata } = JSON.parse(res.body);

      expect(metadata.currentPage).toBe(3);
      expect(mock.lastCall('offset')?.args[0]).toBe(20);
    });
  });
});
