import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { db } from '../../db';
import { entities } from '../../db/schema';
import { ilike, sql, or } from 'drizzle-orm';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const searchQuery = event.queryStringParameters?.q;

    if (!searchQuery || searchQuery.length < 2) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Termo de busca deve ter pelo menos 2 caracteres.' }) };
    }

    const results = await db
        .select({
            id: entities.id,
            name: entities.name,
            type: entities.type
        })
        .from(entities)
        .where(
            or(
            // Busca tradicional (se o usuário digitar certinho parte do nome)
            ilike(entities.name, `%${searchQuery}%`), 
            
            // Busca fuzzy com pg_trgm (Mcdonaldz -> McDonald's)
            sql`${entities.name} % ${searchQuery}`
            )
        )
        // Ordena calculando a distância trigramática: o mais semelhante aparece no topo
        .orderBy(sql`${entities.name} <-> ${searchQuery}`) 
        .limit(10);

    return {
      statusCode: 200,
      body: JSON.stringify(results),
    };

  } catch (error) {
    console.error('Erro na busca de entidades:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Erro interno do servidor.' }) };
  }
};