import { createDbMock } from '../../helpers/dbMock';
import { buildEvent } from '../../helpers/event';

const mock = createDbMock();
jest.mock('../../../src/db', () => ({ db: mock.db }));

const { handler } = require('../../../src/functions/engagement/corroborate') as {
  handler: (event: any) => Promise<{ statusCode: number; body: string }>;
};

beforeEach(() => mock.reset());

describe('POST /complaints/{id}/corroborate', () => {
  it('registra a corroboração numa transação e retorna 200', async () => {
    const res = await handler(
      buildEvent({ pathParameters: { id: 'complaint-1' }, sub: 'user-9' }),
    );

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).message).toMatch(/sucesso/i);
    expect(mock.transaction).toHaveBeenCalledTimes(1);
  });

  it('insere a corroboração com o complaintId da URL e o sub do Cognito', async () => {
    await handler(buildEvent({ pathParameters: { id: 'complaint-1' }, sub: 'user-9' }));

    expect(mock.lastCall('values')?.args[0]).toEqual({
      complaintId: 'complaint-1',
      userId: 'user-9',
    });
  });

  it('retorna 400 quando o id da reclamação está ausente', async () => {
    const res = await handler(buildEvent({ pathParameters: null }));

    expect(res.statusCode).toBe(400);
    expect(mock.transaction).not.toHaveBeenCalled();
  });

  it('retorna 409 quando o usuário já corroborou (violação de unicidade 23505)', async () => {
    mock.queueError({ code: '23505' });

    const res = await handler(buildEvent({ pathParameters: { id: 'complaint-1' } }));

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).error).toMatch(/já corroborou/i);
  });

  it('retorna 500 para outros erros do banco', async () => {
    mock.queueError({ code: '08006', message: 'connection failure' });

    const res = await handler(buildEvent({ pathParameters: { id: 'complaint-1' } }));

    expect(res.statusCode).toBe(500);
  });
});
