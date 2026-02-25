-- ============================================================
-- MonoStock — CLEAN INSTALL (drops and recreates everything)
-- Paste into Supabase SQL Editor and run
-- ============================================================

-- Drop all existing tables
DROP TABLE IF EXISTS backups CASCADE;
DROP TABLE IF EXISTS app_settings CASCADE;
DROP TABLE IF EXISTS user_preferences CASCADE;
DROP TABLE IF EXISTS verification_tokens CASCADE;
DROP TABLE IF EXISTS trust_scores CASCADE;
DROP TABLE IF EXISTS user_flags CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS folder_collaborators CASCADE;
DROP TABLE IF EXISTS connections CASCADE;
DROP TABLE IF EXISTS business_profiles CASCADE;
DROP TABLE IF EXISTS businesses CASCADE;
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
  user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_id TEXT
);

-- Inventory
CREATE TABLE inventory (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_id TEXT
);

-- Order folders
CREATE TABLE order_folders (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_id TEXT
);

-- Trash (soft-deleted items)
CREATE TABLE trash (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_id TEXT
);

-- Products
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_id TEXT
);

-- Users (app-level auth)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  avatar TEXT,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verification_level TEXT NOT NULL DEFAULT 'none',
  domain TEXT,
  domain_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verification_badge BOOLEAN NOT NULL DEFAULT FALSE,
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
  user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User preferences (per-user settings sync)
CREATE TABLE user_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email / domain verification tokens
CREATE TABLE verification_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'email',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_verification_tokens_token ON verification_tokens(token);
CREATE INDEX idx_verification_tokens_user ON verification_tokens(user_id);

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
  contact_links JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Folder collaborators (shared folder access)
CREATE TABLE folder_collaborators (
  id TEXT PRIMARY KEY,
  folder_id TEXT NOT NULL REFERENCES order_folders(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor')),
  invited_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(folder_id, user_id)
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
  body TEXT NOT NULL DEFAULT '',
  read BOOLEAN NOT NULL DEFAULT FALSE,
  attachments JSONB NOT NULL DEFAULT '[]',
  msg_type TEXT NOT NULL DEFAULT 'text',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trust scores (cached per-user score breakdown)
CREATE TABLE trust_scores (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total INTEGER NOT NULL DEFAULT 0,
  identity_score INTEGER NOT NULL DEFAULT 0,
  business_score INTEGER NOT NULL DEFAULT 0,
  behavior_score INTEGER NOT NULL DEFAULT 0,
  reputation_score INTEGER NOT NULL DEFAULT 0,
  penalties INTEGER NOT NULL DEFAULT 0,
  breakdown JSONB NOT NULL DEFAULT '{}',
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User flags / disputes (drives penalty deductions)
CREATE TABLE user_flags (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'flag',
  reason TEXT NOT NULL DEFAULT '',
  severity TEXT NOT NULL DEFAULT 'low',
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX idx_user_flags_user ON user_flags(user_id);
CREATE INDEX idx_user_flags_resolved ON user_flags(resolved);

CREATE INDEX idx_fc_folder ON folder_collaborators(folder_id);
CREATE INDEX idx_fc_user   ON folder_collaborators(user_id);

CREATE INDEX idx_connections_requester ON connections(requester_id);
CREATE INDEX idx_connections_receiver ON connections(receiver_id);
CREATE INDEX idx_connections_status ON connections(status);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_receiver ON messages(receiver_id);
CREATE INDEX idx_business_profiles_user ON business_profiles(user_id);
CREATE INDEX idx_business_profiles_visibility ON business_profiles(visibility);

-- Foreign keys for user_id on data tables (added after users table exists)
ALTER TABLE orders       ADD CONSTRAINT fk_orders_user       FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE customers    ADD CONSTRAINT fk_customers_user    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE inventory    ADD CONSTRAINT fk_inventory_user    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE order_folders ADD CONSTRAINT fk_order_folders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE trash        ADD CONSTRAINT fk_trash_user        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE products     ADD CONSTRAINT fk_products_user     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE backups      ADD CONSTRAINT fk_backups_user      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Seed default title
INSERT INTO app_settings (key, value) VALUES ('title', 'MonoStock');

-- ============================================================
-- Row Level Security
--
-- All data access goes through the Express server which uses
-- the Supabase service_role key (bypasses RLS automatically).
-- These policies DENY direct access via the anon/authenticated
-- keys so that even if the Supabase URL + anon key leak, no
-- data is exposed.
-- ============================================================

ALTER TABLE orders              ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory           ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_folders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE trash               ENABLE ROW LEVEL SECURITY;
ALTER TABLE products            ENABLE ROW LEVEL SECURITY;
ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE backups             ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences    ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections         ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_scores        ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_flags          ENABLE ROW LEVEL SECURITY;
ALTER TABLE folder_collaborators ENABLE ROW LEVEL SECURITY;

-- No permissive policies are created.
-- RLS enabled + no matching policy = deny all for anon/authenticated roles.
-- The service_role key used by the Express server bypasses RLS entirely.
