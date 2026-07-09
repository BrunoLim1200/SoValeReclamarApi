import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { db } from '../../db';
import { complaints, corroborations } from '../../db/schema';
import { eq, sql } from 'drizzle-orm';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const complaintId = event.pathParameters?.id;

    if (!complaintId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'ID da reclamação é obrigatório.' }) };
    }

    const claims = event.requestContext.authorizer?.jwt?.claims;
    const authorId = claims?.sub as string;

    await db.transaction(async (tx) => {
      await tx.insert(corroborations).values({
        complaintId,
        userId: authorId,
      });

      await tx.update(complaints)
        .set({ corroborationCount: sql`${complaints.corroborationCount} + 1` })
        .where(eq(complaints.id, complaintId));
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Reclamação corroborada com sucesso!' }),
    };

  } catch (error: any) {
    if (error.code === '23505') {
      return { 
        statusCode: 409, 
        body: JSON.stringify({ error: 'Você já corroborou com esta reclamação.' }) 
      };
    }

    console.error('Erro ao corroborar:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Erro interno do servidor.' }) };
  }
};