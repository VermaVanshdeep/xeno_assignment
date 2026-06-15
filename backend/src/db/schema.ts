import { pgTable, uuid, varchar, timestamp, text, jsonb, numeric, index, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 1. Customers Table
export const customers = pgTable('customers', {
  id: uuid('id').defaultRandom().primaryKey(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  phone: varchar('phone', { length: 50 }).notNull().unique(),
  city: varchar('city', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('customers_email_idx').on(table.email),
  index('customers_phone_idx').on(table.phone),
  index('customers_city_idx').on(table.city),
  index('customers_created_at_idx').on(table.createdAt),
]);

// 2. Orders Table
export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerId: uuid('customer_id')
    .references(() => customers.id, { onDelete: 'cascade' })
    .notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  orderDate: timestamp('order_date').defaultNow().notNull(),
}, (table) => [
  index('orders_customer_id_idx').on(table.customerId),
  index('orders_category_idx').on(table.category),
  index('orders_order_date_idx').on(table.orderDate),
  index('orders_amount_idx').on(table.amount),
]);

// 3. Segments Table
export const segments = pgTable('segments', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  rulesJson: jsonb('rules_json').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 4. Campaigns Table
export const campaigns = pgTable('campaigns', {
  id: uuid('id').defaultRandom().primaryKey(),
  segmentId: uuid('segment_id').references(() => segments.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  channel: varchar('channel', { length: 50 }).notNull(), // WHATSAPP, SMS, EMAIL, RCS
  messageTemplate: text('message_template').notNull(),
  status: varchar('status', { length: 50 }).default('DRAFT').notNull(), // DRAFT, SCHEDULED, RUNNING, COMPLETED, FAILED, CANCELLED
  audienceSize: integer('audience_size').default(0).notNull(),
  // AI-generated metadata: draft-time (objective, ctaText, recommendedSendTime, reasoning)
  // and post-launch snapshot (performanceSummary, optimizationRecommendations, nextBestCampaign, audienceExpansion, insightsGeneratedAt)
  metadataJson: jsonb('metadata_json').default({}).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('campaigns_status_idx').on(table.status),
  index('campaigns_created_at_idx').on(table.createdAt),
]);

// 5. Campaign Audience Table (Launch target snapshots)
export const campaignAudience = pgTable('campaign_audience', {
  id: uuid('id').defaultRandom().primaryKey(),
  campaignId: uuid('campaign_id')
    .references(() => campaigns.id, { onDelete: 'cascade' })
    .notNull(),
  customerId: uuid('customer_id')
    .references(() => customers.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('campaign_audience_campaign_id_idx').on(table.campaignId),
  index('campaign_audience_customer_id_idx').on(table.customerId),
  index('campaign_audience_composite_idx').on(table.campaignId, table.customerId),
]);

// 6. Communication Events Table (Delivery receipts callbacks)
export const communicationEvents = pgTable('communication_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  campaignId: uuid('campaign_id')
    .references(() => campaigns.id, { onDelete: 'cascade' })
    .notNull(),
  customerId: uuid('customer_id')
    .references(() => customers.id, { onDelete: 'cascade' })
    .notNull(),
  eventType: varchar('event_type', { length: 50 }).notNull(), // SENT, DELIVERED, FAILED, OPENED, READ, CLICKED
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  metadataJson: jsonb('metadata_json').default({}).notNull(), // failureReason, messageId, etc.
}, (table) => [
  index('comm_events_campaign_id_idx').on(table.campaignId),
  index('comm_events_customer_id_idx').on(table.customerId),
  index('comm_events_event_type_idx').on(table.eventType),
  index('comm_events_timestamp_idx').on(table.timestamp),
]);

// 7. Communication Jobs Table (Execution buffer)
export const communicationJobs = pgTable('communication_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  campaignId: uuid('campaign_id')
    .references(() => campaigns.id, { onDelete: 'cascade' })
    .notNull(),
  customerId: uuid('customer_id')
    .references(() => customers.id, { onDelete: 'cascade' })
    .notNull(),
  status: varchar('status', { length: 50 }).default('PENDING').notNull(), // PENDING, PROCESSING, SUCCESS, FAILED
  retryCount: integer('retry_count').default(0).notNull(),
  lastError: text('last_error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('comm_jobs_campaign_id_idx').on(table.campaignId),
  index('comm_jobs_customer_id_idx').on(table.customerId),
  index('comm_jobs_status_idx').on(table.status),
  index('comm_jobs_composite_idx').on(table.campaignId, table.customerId),
]);


/* --- ENTITY RELATIONSHIPS DEFINITIONS --- */

// Customers Relations
export const customersRelations = relations(customers, ({ many }) => ({
  orders: many(orders),
  campaignAudiences: many(campaignAudience),
  communicationEvents: many(communicationEvents),
  communicationJobs: many(communicationJobs),
}));

// Orders Relations
export const ordersRelations = relations(orders, ({ one }) => ({
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
}));

// Segments Relations
export const segmentsRelations = relations(segments, ({ many }) => ({
  campaigns: many(campaigns),
}));

// Campaigns Relations
export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  segment: one(segments, {
    fields: [campaigns.segmentId],
    references: [segments.id],
  }),
  audiences: many(campaignAudience),
  events: many(communicationEvents),
  jobs: many(communicationJobs),
}));

// Campaign Audience Relations
export const campaignAudienceRelations = relations(campaignAudience, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignAudience.campaignId],
    references: [campaigns.id],
  }),
  customer: one(customers, {
    fields: [campaignAudience.customerId],
    references: [customers.id],
  }),
}));

// Communication Events Relations
export const communicationEventsRelations = relations(communicationEvents, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [communicationEvents.campaignId],
    references: [campaigns.id],
  }),
  customer: one(customers, {
    fields: [communicationEvents.customerId],
    references: [customers.id],
  }),
}));

// Communication Jobs Relations
export const communicationJobsRelations = relations(communicationJobs, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [communicationJobs.campaignId],
    references: [campaigns.id],
  }),
  customer: one(customers, {
    fields: [communicationJobs.customerId],
    references: [customers.id],
  }),
}));
