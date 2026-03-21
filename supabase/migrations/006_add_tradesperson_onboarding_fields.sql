ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS service_radius_miles INTEGER;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_service_radius_miles_check'
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_service_radius_miles_check
    CHECK (
      service_radius_miles IS NULL OR service_radius_miles IN (5, 10, 25, 50)
    );
  END IF;
END
$$;
