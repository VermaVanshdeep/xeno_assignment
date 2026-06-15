-- Migration: Add AI metadata column to campaigns table
-- Run once: psql $DATABASE_URL -f backend/drizzle/add_campaign_metadata.sql

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS metadata_json jsonb DEFAULT '{}'::jsonb;
