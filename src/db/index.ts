import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

// Desabilitamos o prefetch do postgres.js pois não é suportado em ambientes Serverless/Neon
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });