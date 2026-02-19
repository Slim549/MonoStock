-- ============================================================
-- MonoStock — Workspace & Collaboration Migration
-- Run this on an EXISTING database (does not drop tables).
-- Paste into Supabase SQL Editor and run.
-- ============================================================

-- 1. Add user_id column to all data tables (nullable first)
ALTER TABLE orders       ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id);
ALTER TABLE customers    ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id);
ALTER TABLE inventory    ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id);
ALTER TABLE order_folders ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id);
ALTER TABLE trash        ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id);
ALTER TABLE products     ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id);

-- 2. Backfill: assign all existing rows to the first registered user
DO $$
DECLARE
  first_user TEXT;
BEGIN
  SELECT id INTO first_user FROM users ORDER BY created_at ASC LIMIT 1;
  IF first_user IS NOT NULL THEN
    UPDATE orders        SET user_id = first_user WHERE user_id IS NULL;
    UPDATE customers     SET user_id = first_user WHERE user_id IS NULL;
    UPDATE inventory     SET user_id = first_user WHERE user_id IS NULL;
    UPDATE order_folders SET user_id = first_user WHERE user_id IS NULL;
    UPDATE trash         SET user_id = first_user WHERE user_id IS NULL;
    UPDATE products      SET user_id = first_user WHERE user_id IS NULL;
  END IF;
END $$;

-- 3. Now make user_id NOT NULL
ALTER TABLE orders       ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE customers    ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE inventory    ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE order_folders ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE trash        ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE products     ALTER COLUMN user_id SET NOT NULL;

-- 4. Add indexes for fast user-scoped queries
CREATE INDEX IF NOT EXISTS idx_orders_user_id        ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_user_id     ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_user_id     ON inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_order_folders_user_id ON order_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_trash_user_id         ON trash(user_id);
CREATE INDEX IF NOT EXISTS idx_products_user_id      ON products(user_id);

-- 5. Create folder_collaborators table
CREATE TABLE IF NOT EXISTS folder_collaborators (
  id TEXT PRIMARY KEY,
  folder_id TEXT NOT NULL REFERENCES order_folders(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor')),
  invited_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(folder_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_fc_folder ON folder_collaborators(folder_id);
CREATE INDEX IF NOT EXISTS idx_fc_user   ON folder_collaborators(user_id);

-- 6. RLS for folder_collaborators
ALTER TABLE folder_collaborators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "full_access" ON folder_collaborators FOR ALL USING (true) WITH CHECK (true);
