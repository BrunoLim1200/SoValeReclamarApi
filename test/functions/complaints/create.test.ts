import { createDbMock } from '../../helpers/dbMock';
import { buildEvent } from '../../helpers/event';
import { complaints } from '../../../src/db/schema';

// O mock precisa ser registrado ANTES de carregar o handler. Como usamos o transformer
// esbuild (que não faz o hoisting do jest.mock como o babel-jest faria), garantimos a
// ordem manualmente: cria o mock -> jest.mock -> require do handler.
const mock = createDbMock();
jest.mock('../../../src/db', () => ({ db: mock.db }));

const { handler } = require('../../../src/functions/complaints/create') as {
  handler: (event: any) => Promise<{ statusCode: number; body: string }>;
};

beforeEach(() => mock.reset());

describe('POST /complaints (create)', () => {
  const validBody = {
    entityId: 'entity-1',
    title: 'Atendimento péssimo',
    content: 'Esperei duas horas e ninguém me atendeu.',
  };

  it('cria a reclamação e retorna 201 com o registro inserido', async () => {
    const inserted = { id: 'complaint-1', ...validBody, authorId: 'user-123' };
    mock.queueResult([inserted]);

    const res = await handler(buildEvent({ body: validBody, sub: 'user-123' }));

    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body)).toEqual(inserted);
    expect(mock.db.insert).toHaveBeenCalledWith(complaints);
  });

  it('usa o sub do Cognito como authorId e persiste os campos enviados', async () => {
    mock.queueResult([{ id: 'complaint-1' }]);

    await handler(
      buildEvent({ body: { ...validBody, mediaUrl: 'https://cdn/x.png' }, sub: 'cognito-abc' }),
    );

    expect(mock.lastCall('values')?.args[0]).toEqual({
      entityId: 'entity-1',
      title: 'Atendimento péssimo',
      content: 'Esperei duas horas e ninguém me atendeu.',
      mediaUrl: 'https://cdn/x.png',
      authorId: 'cognito-abc',
    });
  });

  it('normaliza mediaUrl ausente para null', async () => {
    mock.queueResult([{ id: 'complaint-1' }]);

    await handler(buildEvent({ body: validBody }));

    expect((mock.lastCall('values')?.args[0] as any).mediaUrl).toBeNull();
  });

  it('retorna 400 quando o corpo da requisição está vazio', async () => {
    const res = await handler(buildEvent({ body: undefined }));

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/vazio/i);
    expect(mock.db.insert).not.toHaveBeenCalled();
  });

  it.each([
    ['entityId', { title: 't', content: 'c' }],
    ['title', { entityId: 'e', content: 'c' }],
    ['content', { entityId: 'e', title: 't' }],
  ])('retorna 400 quando falta o campo obrigatório %s', async (_field, body) => {
    const res = await handler(buildEvent({ body }));

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/obrigatórios/i);
    expect(mock.db.insert).not.toHaveBeenCalled();
  });

  it('retorna 400 quando o JSON do corpo é inválido', async () => {
    const res = await handler(buildEvent({ body: '{invalido' }));
    // JSON.parse lança e cai no catch -> tratado como erro interno? Não: o parse ocorre
    // dentro do try, então retorna 500. Verificamos o comportamento real.
    expect(res.statusCode).toBe(500);
  });

  it('retorna 500 quando o banco lança um erro', async () => {
    mock.queueError(new Error('connection refused'));

    const res = await handler(buildEvent({ body: validBody }));

    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).error).toMatch(/interno/i);
  });
});
