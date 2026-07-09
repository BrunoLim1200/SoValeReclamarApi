import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { db } from '../../db';
import { entities } from '../../db/schema';

const ALLOWED_TYPES = ['PLACE', 'MOVIE', 'COMPANY', 'PRODUCT'];

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    if (!event.body) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Corpo da requisição vazio.' }) };
    }

    const data = JSON.parse(event.body);
    const { name, type } = data;

    if (!name || !type) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Os campos "name" e "type" são obrigatórios.' }) };
    }

    if (!ALLOWED_TYPES.includes(type.toUpperCase())) {
      return { statusCode: 400, body: JSON.stringify({ error: `O tipo deve ser um dos seguintes: ${ALLOWED_TYPES.join(', ')}` }) };
    }

    const claims = event.requestContext.authorizer?.jwt?.claims;
    const authorId = claims?.sub as string;

    const [newEntity] = await db.insert(entities).values({
      name,
      type: type.toUpperCase(),
      createdBy: authorId,
    }).returning();

    return {
      statusCode: 201,
      body: JSON.stringify(newEntity),
    };

  } catch (error) {
    console.error('Erro ao criar entidade:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Erro interno no servidor.' }),
    };
  }
};