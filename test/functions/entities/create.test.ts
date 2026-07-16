import { createDbMock } from '../../helpers/dbMock';
import { buildEvent } from '../../helpers/event';
import { entities } from '../../../src/db/schema';

const mock = createDbMock();
jest.mock('../../../src/db', () => ({ db: mock.db }));

const { handler } = require('../../../src/functions/entities/create') as {
  handler: (event: any) => Promise<{ statusCode: number; body: string }>;
};

beforeEach(() => mock.reset());

describe('POST /entities (create)', () => {
  it('cria a entidade e retorna 201', async () => {
    const created = { id: 'e1', name: 'McDonald\'s', type: 'COMPANY', createdBy: 'user-1' };
    mock.queueResult([created]);

    const res = await handler(
      buildEvent({ body: { name: "McDonald's", type: 'COMPANY' }, sub: 'user-1' }),
    );

    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body)).toEqual(created);
    expect(mock.db.insert).toHaveBeenCalledWith(entities);
  });

  it('normaliza o type para maiúsculas e usa o sub como createdBy', async () => {
    mock.queueResult([{ id: 'e1' }]);

    await handler(buildEvent({ body: { name: 'Filme X', type: 'movie' }, sub: 'author-7' }));

    expect(mock.lastCall('values')?.args[0]).toEqual({
      name: 'Filme X',
      type: 'MOVIE',
      createdBy: 'author-7',
    });
  });

  it('retorna 400 quando o corpo está vazio', async () => {
    const res = await handler(buildEvent({ body: undefined }));
    expect(res.statusCode).toBe(400);
    expect(mock.db.insert).not.toHaveBeenCalled();
  });

  it.each([
    ['name', { type: 'PLACE' }],
    ['type', { name: 'Loja' }],
  ])('retorna 400 quando falta %s', async (_field, body) => {
    const res = await handler(buildEvent({ body }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/obrigatórios/i);
  });

  it('retorna 400 para um type fora da lista permitida', async () => {
    const res = await handler(buildEvent({ body: { name: 'X', type: 'ALIEN' } }));

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/PLACE, MOVIE, COMPANY, PRODUCT/);
    expect(mock.db.insert).not.toHaveBeenCalled();
  });

  it.each(['PLACE', 'MOVIE', 'COMPANY', 'PRODUCT'])(
    'aceita o type permitido %s',
    async (type) => {
      mock.queueResult([{ id: 'e1' }]);
      const res = await handler(buildEvent({ body: { name: 'X', type } }));
      expect(res.statusCode).toBe(201);
    },
  );

  it('retorna 500 quando o banco falha', async () => {
    mock.queueError(new Error('db error'));
    const res = await handler(buildEvent({ body: { name: 'X', type: 'PLACE' } }));
    expect(res.statusCode).toBe(500);
  });
});
