-- ============================================================
-- MonoStock — CLEAN INSTALL (drops and recreates everything)
-- Paste into Supabase SQL Editor and run
-- ============================================================

-- Drop all existing tables
DROP TABLE IF EXISTS backups CASCADE;
DROP TABLE IF EXISTS app_settings CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS trash CASCADE;
DROP TABLE IF EXISTS order_folders CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS orders CASCADE;

-- Orders (each row stores the full order object as JSONB)
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Inventory
CREATE TABLE inventory (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Order folders
CREATE TABLE order_folders (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Trash (soft-deleted items)
CREATE TABLE trash (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Products
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Users (app-level auth)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  avatar TEXT,
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

-- App settings (dashboard title, etc.)
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Backups (point-in-time JSON snapshots)
CREATE TABLE backups (
  id SERIAL PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default title
INSERT INTO app_settings (key, value) VALUES ('title', 'MonoStock');

-- Enable RLS on all tables
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE trash ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE backups ENABLE ROW LEVEL SECURITY;

-- Open access policies (tighten for production)
CREATE POLICY "full_access" ON orders         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "full_access" ON customers      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "full_access" ON inventory      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "full_access" ON order_folders  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "full_access" ON trash          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "full_access" ON products       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "full_access" ON users          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "full_access" ON app_settings   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "full_access" ON backups        FOR ALL USING (true) WITH CHECK (true);
