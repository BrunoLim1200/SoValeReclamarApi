import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { db } from '../../db';
import { complaints } from '../../db/schema';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    if (!event.body) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Corpo da requisição vazio.' }) };
    }

    const data = JSON.parse(event.body);
    const { entityId, title, content, mediaUrl } = data;

    if (!entityId || !title || !content) {
      return { statusCode: 400, body: JSON.stringify({ error: 'entityId, title e content são obrigatórios.' }) };
    }
    
    const claims = event.requestContext.authorizer?.jwt?.claims;
    const authorId = claims?.sub as string; 

    const [newComplaint] = await db.insert(complaints).values({
      entityId,
      authorId,
      title,
      content,
      mediaUrl: mediaUrl || null,
    }).returning(); 

    return {
      statusCode: 201,
      body: JSON.stringify(newComplaint),
    };

  } catch (error) {
    console.error('Erro ao criar reclamação:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Erro interno no servidor.' }),
    };
  }
};