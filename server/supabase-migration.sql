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

-- User preferences (per-user settings sync)
CREATE TABLE user_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Business profiles (B2B networking)
CREATE TABLE business_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL DEFAULT '',
  logo TEXT,
  description TEXT NOT NULL DEFAULT '',
  industry_tags TEXT[] NOT NULL DEFAULT '{}',
  business_type TEXT NOT NULL DEFAULT 'Service',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'public',
  allow_requests TEXT NOT NULL DEFAULT 'everyone',
  hide_location BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Connections between businesses
CREATE TABLE connections (
  id TEXT PRIMARY KEY,
  requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(requester_id, receiver_id)
);

-- Messages between connected businesses
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_connections_requester ON connections(requester_id);
CREATE INDEX idx_connections_receiver ON connections(receiver_id);
CREATE INDEX idx_connections_status ON connections(status);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_receiver ON messages(receiver_id);
CREATE INDEX idx_business_profiles_user ON business_profiles(user_id);
CREATE INDEX idx_business_profiles_visibility ON business_profiles(visibility);

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
CREATE POLICY "full_access" ON backups           FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "full_access" ON user_preferences  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "full_access" ON business_profiles FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "full_access" ON connections FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "full_access" ON messages FOR ALL USING (true) WITH CHECK (true);
