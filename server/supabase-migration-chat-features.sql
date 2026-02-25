-- Migration: Chat attachments + folder invite system
-- Run this in the Supabase SQL Editor.

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]';

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS msg_type TEXT NOT NULL DEFAULT 'text';

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';
