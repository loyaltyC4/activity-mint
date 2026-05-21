-- Wave 3: Supabase-stored tracking, competitor tracking, digest preferences
-- Run this migration against your Supabase project to create the required tables.

-- Account snapshots (replaces localStorage tracking)
CREATE TABLE IF NOT EXISTS account_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  engagement_rate REAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, username, created_at)
);
CREATE INDEX IF NOT EXISTS idx_snapshots_user_account ON account_snapshots(user_id, username, created_at);

-- Competitor tracking
CREATE TABLE IF NOT EXISTS competitor_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, username)
);

-- Competitor snapshots
CREATE TABLE IF NOT EXISTS competitor_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  competitor_id UUID NOT NULL REFERENCES competitor_tracking(id) ON DELETE CASCADE,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  engagement_rate REAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_comp_snapshots ON competitor_snapshots(competitor_id, created_at);

-- Digest preferences
CREATE TABLE IF NOT EXISTS digest_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN DEFAULT FALSE,
  frequency TEXT DEFAULT 'weekly' CHECK (frequency IN ('weekly', 'daily')),
  day_of_week INTEGER DEFAULT 1 CHECK (day_of_week BETWEEN 0 AND 6),
  include_competitors BOOLEAN DEFAULT TRUE,
  include_alerts BOOLEAN DEFAULT TRUE,
  include_recommendations BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE account_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own snapshots" ON account_snapshots FOR ALL USING (auth.uid() = user_id);

ALTER TABLE competitor_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own competitors" ON competitor_tracking FOR ALL USING (auth.uid() = user_id);

ALTER TABLE competitor_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own competitor snapshots" ON competitor_snapshots FOR ALL
  USING (competitor_id IN (SELECT id FROM competitor_tracking WHERE user_id = auth.uid()));

ALTER TABLE digest_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own prefs" ON digest_preferences FOR ALL USING (auth.uid() = user_id);
