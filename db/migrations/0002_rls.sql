-- ============================================================================
-- 0002_rls.sql : Row Level Security (RLS) natif PostgreSQL
-- Fonctionne avec `SET LOCAL app.current_user_id = '<uuid>';` transmis par Node.js
-- ============================================================================

-- Fonctions de contexte de session PostgreSQL (remplacent auth.uid() de Supabase)
CREATE OR REPLACE FUNCTION public.current_app_user_id() RETURNS UUID
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::UUID;
$$;

CREATE OR REPLACE FUNCTION public.is_moderator_or_admin() RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = public.current_app_user_id()
      AND role IN ('moderator', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = public.current_app_user_id()
      AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_verified_address_id() RETURNS UUID
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT address_id FROM public.profiles
  WHERE id = public.current_app_user_id()
    AND verification_status IN ('verified_by_code', 'verified_by_admin')
    AND address_id IS NOT NULL;
$$;

-- Activation RLS
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.halloween_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advent_calendar ENABLE ROW LEVEL SECURITY;

-- Policies : addresses
DROP POLICY IF EXISTS "Addresses viewable by everyone" ON public.addresses;
CREATE POLICY "Addresses viewable by everyone" ON public.addresses
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Only admins modify addresses" ON public.addresses;
CREATE POLICY "Only admins modify addresses" ON public.addresses
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Policies : profiles
DROP POLICY IF EXISTS "Read own profile or moderators read all" ON public.profiles;
CREATE POLICY "Read own profile or moderators read all" ON public.profiles
  FOR SELECT USING (id = public.current_app_user_id() OR public.is_moderator_or_admin());

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (id = public.current_app_user_id() OR public.is_moderator_or_admin());

-- Policies : halloween_registrations
DROP POLICY IF EXISTS "Public views approved halloween" ON public.halloween_registrations;
CREATE POLICY "Public views approved halloween" ON public.halloween_registrations
  FOR SELECT USING (
    is_approved = true
    OR user_id = public.current_app_user_id()
    OR public.is_moderator_or_admin()
  );

DROP POLICY IF EXISTS "Verified residents manage own halloween" ON public.halloween_registrations;
CREATE POLICY "Verified residents manage own halloween" ON public.halloween_registrations
  FOR ALL
  USING (
    (user_id = public.current_app_user_id() AND address_id = public.get_user_verified_address_id())
    OR public.is_moderator_or_admin()
  )
  WITH CHECK (
    (user_id = public.current_app_user_id() AND address_id = public.get_user_verified_address_id())
    OR public.is_moderator_or_admin()
  );

-- Policies : advent_calendar
DROP POLICY IF EXISTS "Public views approved advent" ON public.advent_calendar;
CREATE POLICY "Public views approved advent" ON public.advent_calendar
  FOR SELECT USING (
    is_approved = true
    OR user_id = public.current_app_user_id()
    OR public.is_moderator_or_admin()
  );

DROP POLICY IF EXISTS "Verified residents manage own advent" ON public.advent_calendar;
CREATE POLICY "Verified residents manage own advent" ON public.advent_calendar
  FOR ALL
  USING (
    (user_id = public.current_app_user_id() AND address_id = public.get_user_verified_address_id())
    OR public.is_moderator_or_admin()
  )
  WITH CHECK (
    (user_id = public.current_app_user_id() AND address_id = public.get_user_verified_address_id())
    OR public.is_moderator_or_admin()
  );

-- Garde-fou : empêche un résident de ré-approuver lui-même un pin révoqué
CREATE OR REPLACE FUNCTION public.guard_is_approved() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_approved IS DISTINCT FROM OLD.is_approved AND NOT public.is_moderator_or_admin() THEN
    RAISE EXCEPTION 'Seul un modérateur peut modifier l''approbation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_approved_h ON public.halloween_registrations;
CREATE TRIGGER trg_guard_approved_h BEFORE UPDATE ON public.halloween_registrations
  FOR EACH ROW EXECUTE FUNCTION public.guard_is_approved();

DROP TRIGGER IF EXISTS trg_guard_approved_a ON public.advent_calendar;
CREATE TRIGGER trg_guard_approved_a BEFORE UPDATE ON public.advent_calendar
  FOR EACH ROW EXECUTE FUNCTION public.guard_is_approved();

