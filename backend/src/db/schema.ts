import { doublePrecision, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const userRoleEnum = pgEnum('user_role', [
  'farmer',
  'evaluator',
  'manager',
  'consumer'
])

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  role: userRoleEnum('role').notNull(),
  locale: text('locale').notNull().default('en'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
})

export const farms = pgTable('farms', {
  id: text('id').primaryKey()
})

export const visits = pgTable('visits', {
  id: text('id').primaryKey()
})

export const mediaCategoryEnum = pgEnum('media_category', [
  'people',
  'tools',
  'plants',
  'place_before',
  'place_after'
])

export const mediaAssets = pgTable('media_assets', {
  id: text('id').primaryKey(),
  bucket: text('bucket').notNull(),
  objectKey: text('object_key').notNull(),
  mimeType: text('mime_type').notNull(),
  category: mediaCategoryEnum('category').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  farmId: text('farm_id').references(() => farms.id, { onDelete: 'set null' }),
  visitId: text('visit_id').references(() => visits.id, { onDelete: 'set null' }),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  uploadedByUserId: text('uploaded_by_user_id').references(() => users.id, { onDelete: 'set null' })
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type MediaAsset = typeof mediaAssets.$inferSelect
export type NewMediaAsset = typeof mediaAssets.$inferInsert
