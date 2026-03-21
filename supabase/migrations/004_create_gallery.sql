CREATE TABLE public.gallery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  project_type TEXT,          -- "kitchen", "bathroom", "full_refurb", "extension", "new_build", "other"
  before_image_url TEXT,      -- optional before photo
  location_city TEXT,
  estimated_cost NUMERIC,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gallery_items ENABLE ROW LEVEL SECURITY;

-- Public: anyone can view gallery items if the owning tradesperson's profile is public
CREATE POLICY "Public gallery items are viewable"
ON public.gallery_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = gallery_items.user_id
    AND p.is_public = true
    AND p.role = 'tradesperson'
  )
);

-- Users can view their own gallery items
CREATE POLICY "Users can view own gallery items"
ON public.gallery_items FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own gallery items
CREATE POLICY "Users can insert own gallery items"
ON public.gallery_items FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own gallery items
CREATE POLICY "Users can update own gallery items"
ON public.gallery_items FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own gallery items
CREATE POLICY "Users can delete own gallery items"
ON public.gallery_items FOR DELETE
USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX gallery_items_user_id_idx ON public.gallery_items(user_id);
CREATE INDEX gallery_items_project_type_idx ON public.gallery_items(project_type);
