import { createDbMock } from '../../helpers/dbMock';
import { buildEvent } from '../../helpers/event';

const mock = createDbMock();
jest.mock('../../../src/db', () => ({ db: mock.db }));

const { handler } = require('../../../src/functions/entities/search') as {
  handler: (event: any) => Promise<{ statusCode: number; body: string }>;
};

beforeEach(() => mock.reset());

describe('GET /entities/search', () => {
  it('retorna 200 com os resultados da busca', async () => {
    const rows = [{ id: 'e1', name: "McDonald's", type: 'COMPANY' }];
    mock.queueResult(rows);

    const res = await handler(buildEvent({ queryStringParameters: { q: 'mcdon' } }));

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual(rows);
  });

  it('limita a busca a 10 resultados', async () => {
    mock.queueResult([]);
    await handler(buildEvent({ queryStringParameters: { q: 'lo' } }));
    expect(mock.lastCall('limit')?.args[0]).toBe(10);
  });

  it('retorna 400 quando o termo de busca está ausente', async () => {
    const res = await handler(buildEvent({ queryStringParameters: null }));

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/2 caracteres/);
    expect(mock.db.select).not.toHaveBeenCalled();
  });

  it('retorna 400 quando o termo tem menos de 2 caracteres', async () => {
    const res = await handler(buildEvent({ queryStringParameters: { q: 'a' } }));

    expect(res.statusCode).toBe(400);
    expect(mock.db.select).not.toHaveBeenCalled();
  });

  it('retorna 500 quando o banco falha (ex: extensão pg_trgm ausente)', async () => {
    mock.queueError(new Error('operator does not exist: text % unknown'));

    const res = await handler(buildEvent({ queryStringParameters: { q: 'mcdon' } }));

    expect(res.statusCode).toBe(500);
  });
});
