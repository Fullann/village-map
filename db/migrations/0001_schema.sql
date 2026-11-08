-- ============================================================================
-- 0001_schema.sql : Schéma PostgreSQL autonome (100% compatible o2switch)
-- Sans dépendance Supabase ni extension superuser obligatoire (PostgreSQL 13+)
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE app_role AS ENUM ('resident', 'moderator', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE verification_status AS ENUM ('pending', 'verified_by_code', 'verified_by_admin', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE active_season AS ENUM ('off_season', 'halloween', 'advent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE advent_participation_type AS ENUM ('window_only', 'hospitality');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1. Référentiel officiel des adresses (Whitelist géographique)
CREATE TABLE IF NOT EXISTS public.addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_cadastre_id TEXT UNIQUE,
    street_name TEXT NOT NULL,
    house_number TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    city TEXT NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    building_footprint JSONB, -- Polygone GeoJSON optionnel
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (street_name, house_number, postal_code)
);

CREATE INDEX IF NOT EXISTS idx_addresses_coords ON public.addresses (lng, lat);

-- 2. Utilisateurs & Profils (fusionnés, remplace auth.users + profiles de Supabase)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL DEFAULT '',
    phone TEXT,
    role app_role NOT NULL DEFAULT 'resident',
    address_id UUID REFERENCES public.addresses(id) ON DELETE SET NULL,
    requested_address_id UUID REFERENCES public.addresses(id) ON DELETE SET NULL,
    verification_status verification_status NOT NULL DEFAULT 'pending',
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Un seul foyer vérifié actif par adresse physique
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_verified_address
ON public.profiles (address_id)
WHERE verification_status IN ('verified_by_code', 'verified_by_admin');

-- 3. Tokens Magic Link (authentification sans mot de passe par email)
CREATE TABLE IF NOT EXISTS public.magic_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE, -- SHA-256 du token envoyé par email
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_magic_links_token ON public.magic_links (token_hash);

-- 4. Paramètres globaux du village (Singleton : id = 1)
CREATE TABLE IF NOT EXISTS public.village_settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    current_season active_season NOT NULL DEFAULT 'off_season',
    season_year INT NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    -- Hash SHA-256 salé ou scrypt géré par le backend Node.js
    -- Valeur par défaut : SHA-256 de "CHANGEME"
    village_secret_code_hash TEXT NOT NULL DEFAULT '057ba03d6c44104863dc7361fe4578965d1887360f90a0895882e58a6248fc86',
    advent_hide_future_details BOOLEAN NOT NULL DEFAULT true,
    -- Configuration cartographique administrable depuis /admin
    map_center_lng DOUBLE PRECISION NOT NULL DEFAULT 6.6323,
    map_center_lat DOUBLE PRECISION NOT NULL DEFAULT 46.5197,
    map_bounds_sw_lng DOUBLE PRECISION NOT NULL DEFAULT 6.62,
    map_bounds_sw_lat DOUBLE PRECISION NOT NULL DEFAULT 46.51,
    map_bounds_ne_lng DOUBLE PRECISION NOT NULL DEFAULT 6.65,
    map_bounds_ne_lat DOUBLE PRECISION NOT NULL DEFAULT 46.53,
    map_style_url TEXT NOT NULL DEFAULT 'https://tiles.openfreemap.org/styles/liberty',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

INSERT INTO public.village_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 5. Inscriptions Halloween
CREATE TABLE IF NOT EXISTS public.halloween_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_year INT NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    address_id UUID NOT NULL REFERENCES public.addresses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_distributing BOOLEAN NOT NULL DEFAULT true,
    start_time TIME NOT NULL DEFAULT '18:00',
    end_time TIME NOT NULL DEFAULT '20:30',
    is_self_service BOOLEAN NOT NULL DEFAULT false,
    access_instructions TEXT CHECK (char_length(access_instructions) <= 280),
    is_approved BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (season_year, address_id)
);

-- 6. Calendrier de l'Avent (1 à 24 décembre)
CREATE TABLE IF NOT EXISTS public.advent_calendar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_year INT NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    day_number INT NOT NULL CHECK (day_number BETWEEN 1 AND 24),
    address_id UUID NOT NULL REFERENCES public.addresses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    participation_type advent_participation_type NOT NULL DEFAULT 'window_only',
    lighting_time TIME NOT NULL DEFAULT '17:30',
    event_start_time TIME,
    event_end_time TIME,
    hospitality_details TEXT CHECK (char_length(hospitality_details) <= 350),
    is_approved BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (season_year, day_number),
    UNIQUE (season_year, address_id),
    CHECK (participation_type = 'window_only' OR event_start_time IS NOT NULL)
);

-- 7. Anti-bruteforce du code villageois
CREATE TABLE IF NOT EXISTS public.verification_attempts (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_verification_attempts_user
ON public.verification_attempts (user_id, attempted_at DESC);

-- Trigger automatique pour updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated ON public.profiles;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_halloween_updated ON public.halloween_registrations;
CREATE TRIGGER trg_halloween_updated BEFORE UPDATE ON public.halloween_registrations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_advent_updated ON public.advent_calendar;
CREATE TRIGGER trg_advent_updated BEFORE UPDATE ON public.advent_calendar FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

