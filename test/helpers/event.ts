import { APIGatewayProxyEvent } from 'aws-lambda';

interface BuildEventOptions {
  body?: unknown; // objeto (será stringificado) ou string crua
  pathParameters?: Record<string, string> | null;
  queryStringParameters?: Record<string, string> | null;
  /** `sub` do Cognito. Passe `null` para simular requisição sem claim de usuário. */
  sub?: string | null;
}

// Constrói um APIGatewayProxyEvent mínimo, porém realista, com só o que os handlers leem:
// event.body, event.pathParameters, event.queryStringParameters e as claims do JWT do Cognito.
export function buildEvent(options: BuildEventOptions = {}): APIGatewayProxyEvent {
  const { body, pathParameters = null, queryStringParameters = null, sub = 'user-123' } =
    options;

  const rawBody =
    body === undefined ? null : typeof body === 'string' ? body : JSON.stringify(body);

  const claims = sub === null ? undefined : { sub };

  return {
    body: rawBody,
    pathParameters,
    queryStringParameters,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/',
    resource: '/',
    stageVariables: null,
    multiValueQueryStringParameters: null,
    requestContext: {
      authorizer: claims ? { jwt: { claims } } : undefined,
    } as any,
  } as APIGatewayProxyEvent;
}
