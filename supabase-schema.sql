-- ============================================================
-- AN PROGRESS — SUPABASE SCHEMA
-- Jalankan semua SQL ini di Supabase SQL Editor
-- Dashboard > SQL Editor > New Query > Paste > Run
-- ============================================================

-- ============================================================
-- 1. PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nama        TEXT,
  panggilan   TEXT,
  umur        TEXT,
  lahir       TEXT,
  kota        TEXT,
  deskripsi   TEXT,
  foto        TEXT,       -- base64 atau URL
  level       INTEGER DEFAULT 1,
  exp         INTEGER DEFAULT 0,
  total_exp   INTEGER DEFAULT 0,
  dark_mode   BOOLEAN DEFAULT FALSE,
  stats       JSONB DEFAULT '{"pengetahuan":0,"kesehatan":0,"uang":0,"sosial":0}',
  productivity_log JSONB DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. QUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS quests (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  judul       TEXT NOT NULL,
  deskripsi   TEXT,
  kategori    TEXT,
  hari        TEXT,
  exp         INTEGER DEFAULT 0,
  tipe        TEXT DEFAULT 'today',   -- 'today' | 'weekly'
  selesai     BOOLEAN DEFAULT FALSE,
  tanggal     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. INVENTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gambar      TEXT,
  nama        TEXT NOT NULL,
  harga       NUMERIC DEFAULT 0,
  tanggal_beli TEXT,
  kondisi     TEXT,
  catatan     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. WISHLIST
-- ============================================================
CREATE TABLE IF NOT EXISTS wishlist (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gambar      TEXT,
  nama        TEXT NOT NULL,
  spesifikasi TEXT,
  harga       NUMERIC DEFAULT 0,
  grup        TEXT DEFAULT 'Semua',
  status      TEXT DEFAULT 'belum',   -- 'belum' | 'dibeli'
  tanggal_beli TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. GOALS
-- ============================================================
CREATE TABLE IF NOT EXISTS goals (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  judul       TEXT NOT NULL,
  kategori    TEXT,
  deskripsi   TEXT,
  selesai     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. SAVINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS savings (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nama        TEXT NOT NULL,
  target      NUMERIC DEFAULT 0,
  terkumpul   NUMERIC DEFAULT 0,
  deadline    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. FINANCE ACCOUNTS
-- ============================================================
CREATE TABLE IF NOT EXISTS finance_accounts (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nama        TEXT NOT NULL,
  ikon        TEXT,
  saldo       NUMERIC DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. TRANSACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipe        TEXT NOT NULL,    -- 'pemasukan' | 'pengeluaran' | 'transfer'
  nominal     NUMERIC DEFAULT 0,
  kategori    TEXT,
  akun        TEXT,
  tanggal     TEXT,
  catatan     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. ACTIVITY LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipe        TEXT,
  teks        TEXT,
  waktu       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 10. AI CHATS
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_chats (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  judul       TEXT,
  pesan       JSONB DEFAULT '[]',   -- array of { role, content, time }
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 11. SOSIAL
-- ============================================================
CREATE TABLE IF NOT EXISTS sosial (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipe        TEXT,
  deskripsi   TEXT,
  tanggal     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS (ROW LEVEL SECURITY)
-- User hanya bisa akses data miliknya sendiri
-- ============================================================

-- Enable RLS semua tabel
ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE quests          ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory       ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist        ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals           ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chats        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sosial          ENABLE ROW LEVEL SECURITY;

-- ---- PROFILES ----
CREATE POLICY "profiles: user akses sendiri" ON profiles
  FOR ALL USING (auth.uid() = id);

-- ---- QUESTS ----
CREATE POLICY "quests: user akses sendiri" ON quests
  FOR ALL USING (auth.uid() = user_id);

-- ---- INVENTORY ----
CREATE POLICY "inventory: user akses sendiri" ON inventory
  FOR ALL USING (auth.uid() = user_id);

-- ---- WISHLIST ----
CREATE POLICY "wishlist: user akses sendiri" ON wishlist
  FOR ALL USING (auth.uid() = user_id);

-- ---- GOALS ----
CREATE POLICY "goals: user akses sendiri" ON goals
  FOR ALL USING (auth.uid() = user_id);

-- ---- SAVINGS ----
CREATE POLICY "savings: user akses sendiri" ON savings
  FOR ALL USING (auth.uid() = user_id);

-- ---- FINANCE ACCOUNTS ----
CREATE POLICY "finance_accounts: user akses sendiri" ON finance_accounts
  FOR ALL USING (auth.uid() = user_id);

-- ---- TRANSACTIONS ----
CREATE POLICY "transactions: user akses sendiri" ON transactions
  FOR ALL USING (auth.uid() = user_id);

-- ---- ACTIVITY LOGS ----
CREATE POLICY "activity_logs: user akses sendiri" ON activity_logs
  FOR ALL USING (auth.uid() = user_id);

-- ---- AI CHATS ----
CREATE POLICY "ai_chats: user akses sendiri" ON ai_chats
  FOR ALL USING (auth.uid() = user_id);

-- ---- SOSIAL ----
CREATE POLICY "sosial: user akses sendiri" ON sosial
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- INDEX untuk performa query
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_quests_user       ON quests(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_user    ON inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_user     ON wishlist(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user        ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_savings_user      ON savings(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user     ON finance_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_actlog_user       ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_aichats_user      ON ai_chats(user_id);
CREATE INDEX IF NOT EXISTS idx_sosial_user       ON sosial(user_id);
