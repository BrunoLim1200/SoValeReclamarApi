import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { db } from '../../db';
import { complaints, users, entities } from '../../db/schema';
import { eq, sql } from 'drizzle-orm';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Pega a página atual da URL (ex: ?page=1). Default é 1.
    const page = parseInt(event.queryStringParameters?.page || '1');
    const limit = 10;
    const offset = (page - 1) * limit;

    // Calculamos o Score de Relevância (Decaimento no Tempo) direto no SQL
    // (Corroborações + 1) / (Horas desde a criação + 2) ^ 1.5
    const relevanceScore = sql`
      (${complaints.corroborationCount} + 1) / 
      POWER(EXTRACT(EPOCH FROM (NOW() - ${complaints.createdAt})) / 3600 + 2, 1.5)
    `;

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
        },
        entity: {
          id: entities.id,
          name: entities.name,
        }
      })
      .from(complaints)
      .innerJoin(users, eq(complaints.authorId, users.id))
      .innerJoin(entities, eq(complaints.entityId, entities.id))
      // Ordenamos pelo score calculado
      .orderBy(sql`${relevanceScore} DESC`)
      .limit(limit)
      .offset(offset);

    // O Backend diz ao Frontend se ainda há mais dados para o scroll continuar
    const hasMore = results.length === limit;

    return {
      statusCode: 200,
      body: JSON.stringify({
        data: results,
        metadata: {
          currentPage: page,
          hasMore,
          nextPage: hasMore ? page + 1 : null
        }
      }),
    };

  } catch (error) {
    console.error('Erro ao gerar feed:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Erro interno do servidor.' }) };
  }
};