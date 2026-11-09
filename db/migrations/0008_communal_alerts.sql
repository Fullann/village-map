-- ============================================================================
-- 0008_communal_alerts.sql :
-- Système de messages d'alerte et flash communal en direct (SSE temps réel)
-- Permet à la mairie d'envoyer un message instantané à tous les téléphones/ordinateurs
-- connectés simultanément (info, météo, changement de lieu, fin de tournée).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.village_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level TEXT NOT NULL DEFAULT 'warning' CHECK (level IN ('info', 'warning', 'urgent')),
    title TEXT NOT NULL DEFAULT 'Message de la Commune',
    message TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_village_alerts_active
  ON public.village_alerts (is_active, created_at DESC);
