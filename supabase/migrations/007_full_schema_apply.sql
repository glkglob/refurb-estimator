-- ============================================================
-- MIGRATION: Full schema apply (001 + 003 + 006 combined)
-- Safe to run even if tables partially exist
-- ============================================================

-- 1. SCENARIOS TABLE
CREATE TABLE IF NOT EXISTS public.scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  input jsonb NOT NULL,
  result jsonb NOT NULL,
  purchase_price numeric,
  gdv numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='scenarios' AND policyname='Users can view own scenarios') THEN
    CREATE POLICY "Users can view own scenarios" ON public.scenarios FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='scenarios' AND policyname='Users can insert own scenarios') THEN
    CREATE POLICY "Users can insert own scenarios" ON public.scenarios FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='scenarios' AND policyname='Users can update own scenarios') THEN
    CREATE POLICY "Users can update own scenarios" ON public.scenarios FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='scenarios' AND policyname='Users can delete own scenarios') THEN
    CREATE POLICY "Users can delete own scenarios" ON public.scenarios FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS scenarios_user_id_idx ON public.scenarios(user_id);

-- 2. BUDGET ACTUALS TABLE
CREATE TABLE IF NOT EXISTS public.budget_actuals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id uuid NOT NULL REFERENCES public.scenarios(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actuals jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.budget_actuals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='budget_actuals' AND policyname='Users can view own budget actuals') THEN
    CREATE POLICY "Users can view own budget actuals" ON public.budget_actuals FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='budget_actuals' AND policyname='Users can insert own budget actuals') THEN
    CREATE POLICY "Users can insert own budget actuals" ON public.budget_actuals FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='budget_actuals' AND policyname='Users can update own budget actuals') THEN
    CREATE POLICY "Users can update own budget actuals" ON public.budget_actuals FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='budget_actuals' AND policyname='Users can delete own budget actuals') THEN
    CREATE POLICY "Users can delete own budget actuals" ON public.budget_actuals FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS budget_actuals_scenario_id_idx ON public.budget_actuals(scenario_id);
CREATE INDEX IF NOT EXISTS budget_actuals_user_id_idx ON public.budget_actuals(user_id);

-- 3. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'tradesperson', 'admin')),
  display_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  business_name TEXT,
  trade_specialty TEXT,
  bio TEXT,
  years_experience INTEGER,
  location_city TEXT,
  location_postcode TEXT,
  website_url TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_public BOOLEAN NOT NULL DEFAULT false,
  service_radius_miles INTEGER,
  onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Public profiles are viewable by everyone') THEN
    CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (is_public = true AND role = 'tradesperson');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Users can view own profile') THEN
    CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Users can update own profile') THEN
    CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Users can insert own profile') THEN
    CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Admins can view all profiles') THEN
    CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='Admins can update any profile') THEN
    CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS profiles_public_trades_idx ON public.profiles(role, is_public) WHERE is_public = true AND role = 'tradesperson';
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles(email);

-- 4. SERVICE RADIUS CONSTRAINT
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_service_radius_miles_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_service_radius_miles_check CHECK (service_radius_miles IS NULL OR service_radius_miles IN (5, 10, 25, 50));
  END IF;
END $$;

-- 5. AUTO-CREATE PROFILE TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. BACKFILL: create profile rows for any existing auth users missing a profile
INSERT INTO public.profiles (id, email)
SELECT u.id, u.email
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;
