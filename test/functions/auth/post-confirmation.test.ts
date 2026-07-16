import { createDbMock } from '../../helpers/dbMock';
import { users } from '../../../src/db/schema';

const mock = createDbMock();
jest.mock('../../../src/db', () => ({ db: mock.db }));

const { handler } = require('../../../src/functions/auth/post-confirmation') as {
  handler: (event: any) => Promise<any>;
};

beforeEach(() => mock.reset());

function buildTriggerEvent(userAttributes: Record<string, string>) {
  return {
    triggerSource: 'PostConfirmation_ConfirmSignUp',
    request: { userAttributes },
    response: {},
  };
}

describe('Cognito PostConfirmation trigger', () => {
  it('provisiona a linha em users usando o sub e o email', async () => {
    const event = buildTriggerEvent({ sub: 'cognito-sub-1', email: 'joao@example.com' });

    const result = await handler(event);

    expect(mock.db.insert).toHaveBeenCalledWith(users);
    expect(mock.lastCall('values')?.args[0]).toEqual({
      id: 'cognito-sub-1',
      username: 'joao@example.com',
    });
    // O trigger deve sempre devolver o evento recebido.
    expect(result).toBe(event);
  });

  it('prefere preferred_username quando disponível', async () => {
    await handler(
      buildTriggerEvent({
        sub: 'cognito-sub-2',
        email: 'joao@example.com',
        preferred_username: 'joaozinho',
      }),
    );

    expect(mock.lastCall('values')?.args[0]).toEqual({
      id: 'cognito-sub-2',
      username: 'joaozinho',
    });
  });

  it('usa onConflictDoNothing para ser idempotente', async () => {
    await handler(buildTriggerEvent({ sub: 's', email: 'e@e.com' }));
    expect(mock.lastCall('onConflictDoNothing')).toBeDefined();
  });

  it('não insere quando faltam sub ou email/username', async () => {
    const event = buildTriggerEvent({ email: 'sem-sub@example.com' });

    const result = await handler(event);

    expect(mock.db.insert).not.toHaveBeenCalled();
    expect(result).toBe(event);
  });

  it('nunca bloqueia a confirmação: devolve o evento mesmo se o banco falhar', async () => {
    mock.queueError(new Error('db down'));
    const event = buildTriggerEvent({ sub: 's', email: 'e@e.com' });

    const result = await handler(event);

    expect(result).toBe(event);
  });
});
