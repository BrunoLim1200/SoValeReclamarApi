import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { db } from '../../db';
import { complaints, users } from '../../db/schema';
import { eq, desc } from 'drizzle-orm';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const entityId = event.pathParameters?.id;

    if (!entityId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'ID da entidade é obrigatório na URL.' }) };
    }

    const results = await db
      .select({
        id: complaints.id,
        title: complaints.title,
        content: complaints.content,
        mediaUrl: complaints.mediaUrl,
        corroborationCount: complaints.corroborationCount,
        createdAt: complaints.createdAt,
        author: {
          id: users.id,
          username: users.username,
        }
      })
      .from(complaints)
      .innerJoin(users, eq(complaints.authorId, users.id))
      .where(eq(complaints.entityId, entityId))
      .orderBy(desc(complaints.corroborationCount), desc(complaints.createdAt))
      .limit(20);

    return {
      statusCode: 200,
      body: JSON.stringify(results),
    };

  } catch (error) {
    console.error('Erro ao listar reclamações:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Erro interno do servidor.' }) };
  }
};