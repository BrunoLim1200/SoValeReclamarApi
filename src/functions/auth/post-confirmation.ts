import { PostConfirmationTriggerEvent } from 'aws-lambda';
import { db } from '../../db';
import { users } from '../../db/schema';

// Trigger do Cognito disparado após a confirmação do cadastro (PostConfirmation).
// Cria a linha correspondente em `users` para que author_id / user_id (FKs NOT NULL)
// tenham um alvo válido antes da primeira reclamação/corroboração do usuário.
export const handler = async (event: PostConfirmationTriggerEvent): Promise<PostConfirmationTriggerEvent> => {
  try {
    const attributes = event.request.userAttributes;
    const id = attributes.sub;
    // Cognito está configurado apenas com email como username. Usamos
    // preferred_username quando o app o enviar no cadastro; senão, o email.
    const username = attributes.preferred_username || attributes.email;

    if (id && username) {
      await db
        .insert(users)
        .values({ id, username })
        .onConflictDoNothing({ target: users.id });
    }
  } catch (error) {
    // Nunca bloqueamos a confirmação do usuário por falha ao provisionar a linha.
    console.error('Erro ao provisionar usuário no PostConfirmation:', error);
  }

  // O trigger do Cognito deve sempre retornar o evento recebido.
  return event;
};
