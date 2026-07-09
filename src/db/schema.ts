// src/db/schema.ts
import { sql } from 'drizzle-orm';
import { index } from 'drizzle-orm/gel-core';
import { pgTable, text, timestamp, uuid, integer, primaryKey } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey(), // Esse ID virá do AWS Cognito
  username: text('username').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const entities = pgTable('entities', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: text('type').notNull(), // 'PLACE', 'MOVIE', etc.
  name: text('name').notNull(),
  createdBy: uuid('created_by').references(() => users.id),
}, (table) => {
  return {
    nameSearchIndex: index('name_search_index').using('gin', sql`{table.name} gin_trgm_ops`)
  };
});

export const complaints = pgTable('complaints', {
  id: uuid('id').defaultRandom().primaryKey(),
  entityId: uuid('entity_id').references(() => entities.id).notNull(),
  authorId: uuid('author_id').references(() => users.id).notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  mediaUrl: text('media_url'),
  corroborationCount: integer('corroboration_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const corroborations = pgTable('corroborations', {
  complaintId: uuid('complaint_id').references(() => complaints.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    // Chave primária composta para impedir que o usuário apoie duas vezes a mesma reclamação
    pk: primaryKey({ columns: [table.complaintId, table.userId] }),
  };
});