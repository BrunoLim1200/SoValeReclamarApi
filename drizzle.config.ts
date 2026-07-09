// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle', // Pasta onde os arquivos SQL serão gerados
  dialect: 'postgresql',
  dbCredentials: {
    // Para rodar as migrations da sua máquina, você precisa da URL.
    // Vamos usar variáveis de ambiente apenas para este momento de desenvolvimento local.
    url: process.env.DATABASE_URL!, 
  },
  verbose: true,
  strict: true,
});