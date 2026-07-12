-- Supabase Database Setup für Table Tennis Liquid
-- Führe diese SQL-Befehle in deinem Supabase SQL Editor aus

-- Erstelle die 'games' Tabelle
CREATE TABLE IF NOT EXISTS games (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    p1_name TEXT NOT NULL DEFAULT 'Spieler 1',
    p2_name TEXT NOT NULL DEFAULT 'Spieler 2',
    p1_scores JSONB NOT NULL DEFAULT '[0, 0, 0, 0]',
    p2_scores JSONB NOT NULL DEFAULT '[0, 0, 0, 0]',
    sound_win TEXT,
    sound_promoted TEXT,
    sound_comeback TEXT,
    p1_comeback_count INTEGER NOT NULL DEFAULT 0,
    p2_comeback_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Füge Sound-Spalten zu bestehenden Tabellen hinzu (falls Tabelle bereits existiert)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='games' AND column_name='sound_win') THEN
        ALTER TABLE games ADD COLUMN sound_win TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='games' AND column_name='sound_promoted') THEN
        ALTER TABLE games ADD COLUMN sound_promoted TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='games' AND column_name='sound_comeback') THEN
        ALTER TABLE games ADD COLUMN sound_comeback TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='games' AND column_name='p1_comeback_count') THEN
        ALTER TABLE games ADD COLUMN p1_comeback_count INTEGER NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='games' AND column_name='p2_comeback_count') THEN
        ALTER TABLE games ADD COLUMN p2_comeback_count INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Erstelle Index für bessere Performance
CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at DESC);

-- Aktiviere Row Level Security (optional, je nach Bedarf)
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Erlaube öffentlichen Zugriff (anpassen je nach Sicherheitsanforderungen)
CREATE POLICY "Allow public access" ON games
    FOR ALL
    USING (true)
    WITH CHECK (true);

