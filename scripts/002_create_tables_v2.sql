-- Drop existing policies if they exist
DO $$ BEGIN
  DROP POLICY IF EXISTS "public_read_tournaments" ON tournaments;
  DROP POLICY IF EXISTS "public_insert_tournaments" ON tournaments;
  DROP POLICY IF EXISTS "public_update_tournaments" ON tournaments;
  DROP POLICY IF EXISTS "public_delete_tournaments" ON tournaments;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "public_read_players" ON players;
  DROP POLICY IF EXISTS "public_insert_players" ON players;
  DROP POLICY IF EXISTS "public_update_players" ON players;
  DROP POLICY IF EXISTS "public_delete_players" ON players;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "public_read_scores" ON scores;
  DROP POLICY IF EXISTS "public_insert_scores" ON scores;
  DROP POLICY IF EXISTS "public_update_scores" ON scores;
  DROP POLICY IF EXISTS "public_delete_scores" ON scores;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "public_read_fines" ON fines;
  DROP POLICY IF EXISTS "public_insert_fines" ON fines;
  DROP POLICY IF EXISTS "public_update_fines" ON fines;
  DROP POLICY IF EXISTS "public_delete_fines" ON fines;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Drop tables if they exist (in correct order due to foreign keys)
DROP TABLE IF EXISTS fines CASCADE;
DROP TABLE IF EXISTS scores CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS tournaments CASCADE;

-- Create tournaments table
CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date DATE NOT NULL,
  location TEXT NOT NULL,
  rules TEXT DEFAULT '',
  password TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create players table
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  handicap NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create scores table
CREATE TABLE scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  total_points INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(player_id, tournament_id)
);

-- Create fines table
CREATE TABLE fines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  amount INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE fines ENABLE ROW LEVEL SECURITY;

-- Public read access for all tables
CREATE POLICY "public_read_tournaments" ON tournaments FOR SELECT USING (true);
CREATE POLICY "public_read_players" ON players FOR SELECT USING (true);
CREATE POLICY "public_read_scores" ON scores FOR SELECT USING (true);
CREATE POLICY "public_read_fines" ON fines FOR SELECT USING (true);

-- Public write access (password verification handled in Server Actions)
CREATE POLICY "public_insert_tournaments" ON tournaments FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_tournaments" ON tournaments FOR UPDATE USING (true);
CREATE POLICY "public_delete_tournaments" ON tournaments FOR DELETE USING (true);

CREATE POLICY "public_insert_players" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_players" ON players FOR UPDATE USING (true);
CREATE POLICY "public_delete_players" ON players FOR DELETE USING (true);

CREATE POLICY "public_insert_scores" ON scores FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_scores" ON scores FOR UPDATE USING (true);
CREATE POLICY "public_delete_scores" ON scores FOR DELETE USING (true);

CREATE POLICY "public_insert_fines" ON fines FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_fines" ON fines FOR UPDATE USING (true);
CREATE POLICY "public_delete_fines" ON fines FOR DELETE USING (true);
