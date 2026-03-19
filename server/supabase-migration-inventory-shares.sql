-- ============================================================
-- Inventory Sharing — allows users to share their full
-- inventory list (read-only) with other users.
-- Run in Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory_shares (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shared_with_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_id, shared_with_id)
);

CREATE INDEX IF NOT EXISTS idx_inv_shares_owner ON inventory_shares(owner_id);
CREATE INDEX IF NOT EXISTS idx_inv_shares_shared ON inventory_shares(shared_with_id);

ALTER TABLE inventory_shares ENABLE ROW LEVEL SECURITY;
