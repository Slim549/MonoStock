-- Migration: Add contact_links column to business_profiles
-- Run this in the Supabase SQL Editor for existing databases.
-- New installs already include this column in supabase-migration.sql.

ALTER TABLE business_profiles
  ADD COLUMN IF NOT EXISTS contact_links JSONB NOT NULL DEFAULT '{}';
