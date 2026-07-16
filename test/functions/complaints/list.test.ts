import { createDbMock } from '../../helpers/dbMock';
import { buildEvent } from '../../helpers/event';

const mock = createDbMock();
jest.mock('../../../src/db', () => ({ db: mock.db }));

const { handler } = require('../../../src/functions/complaints/list') as {
  handler: (event: any) => Promise<{ statusCode: number; body: string }>;
};

beforeEach(() => mock.reset());

describe('GET /entities/{id}/complaints (list)', () => {
  it('retorna 200 com as reclamações da entidade', async () => {
    const rows = [
      {
        id: 'c1',
        title: 'Ruim',
        content: '...',
        mediaUrl: null,
        corroborationCount: 5,
        createdAt: '2026-01-01T00:00:00.000Z',
        author: { id: 'u1', username: 'joao' },
      },
    ];
    mock.queueResult(rows);

    const res = await handler(buildEvent({ pathParameters: { id: 'entity-1' } }));

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual(rows);
  });

  it('filtra pela entidade da URL e limita a 20 resultados', async () => {
    mock.queueResult([]);

    await handler(buildEvent({ pathParameters: { id: 'entity-42' } }));

    expect(mock.lastCall('limit')?.args[0]).toBe(20);
    // where(eq(complaints.entityId, entityId)) foi chamado
    expect(mock.lastCall('where')).toBeDefined();
  });

  it('retorna 400 quando o id da entidade não está na URL', async () => {
    const res = await handler(buildEvent({ pathParameters: null }));

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/obrigatório/i);
    expect(mock.db.select).not.toHaveBeenCalled();
  });

  it('retorna 500 quando o banco lança um erro', async () => {
    mock.queueError(new Error('db down'));

    const res = await handler(buildEvent({ pathParameters: { id: 'entity-1' } }));

    expect(res.statusCode).toBe(500);
  });
});
