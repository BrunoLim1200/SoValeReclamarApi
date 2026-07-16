// Mock reutilizável do `db` (Drizzle). Os handlers usam query builders encadeados
// e "thenable" (ex: `await db.insert(x).values(y).returning()` ou
// `await db.select(...).from(...).where(...).limit(...)`). Este helper cria um objeto
// que:
//   - aceita qualquer método encadeado retornando ele mesmo;
//   - resolve (ou rejeita) quando "awaited", com o valor configurado pelo teste;
//   - registra todas as chamadas de método para permitir asserções sobre os argumentos
//     realmente passados ao Drizzle (ex: o objeto enviado ao `.values()`).

type Outcome = { value?: unknown; error?: unknown };

export interface RecordedCall {
  method: string;
  args: unknown[];
}

export interface DbMock {
  db: any;
  transaction: jest.Mock;
  /** Registro global de chamadas encadeadas (values, where, limit, etc.). */
  calls: RecordedCall[];
  /** Enfileira o resultado do próximo `await` de uma query. */
  queueResult: (value: unknown) => void;
  /** Enfileira uma rejeição para o próximo `await` de uma query. */
  queueError: (error: unknown) => void;
  /** Retorna a última chamada registrada de um dado método (ex: 'values'). */
  lastCall: (method: string) => RecordedCall | undefined;
  /** Limpa filas e registros entre os testes. */
  reset: () => void;
}

export function createDbMock(): DbMock {
  const outcomes: Outcome[] = [];
  const calls: RecordedCall[] = [];

  function nextOutcome(): Outcome {
    return outcomes.length ? outcomes.shift()! : { value: [] };
  }

  function makeChain(): any {
    const proxy: any = new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === 'then') {
            const outcome = nextOutcome();
            return (resolve: any, reject: any) =>
              ('error' in outcome
                ? Promise.reject(outcome.error)
                : Promise.resolve(outcome.value)
              ).then(resolve, reject);
          }
          if (typeof prop === 'symbol' || prop === 'catch' || prop === 'finally') {
            return undefined;
          }
          return (...args: unknown[]) => {
            calls.push({ method: String(prop), args });
            return proxy;
          };
        },
      },
    );
    return proxy;
  }

  const transaction = jest.fn(async (cb: (tx: any) => Promise<unknown>) => {
    const tx = {
      insert: jest.fn(() => makeChain()),
      update: jest.fn(() => makeChain()),
      select: jest.fn(() => makeChain()),
      delete: jest.fn(() => makeChain()),
    };
    return cb(tx);
  });

  const db = {
    select: jest.fn(() => makeChain()),
    insert: jest.fn(() => makeChain()),
    update: jest.fn(() => makeChain()),
    delete: jest.fn(() => makeChain()),
    transaction,
  };

  return {
    db,
    transaction,
    calls,
    queueResult: (value: unknown) => outcomes.push({ value }),
    queueError: (error: unknown) => outcomes.push({ error }),
    lastCall: (method: string) =>
      [...calls].reverse().find((c) => c.method === method),
    reset: () => {
      outcomes.length = 0;
      calls.length = 0;
    },
  };
}
