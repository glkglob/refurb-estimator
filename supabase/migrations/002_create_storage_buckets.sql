-- Gallery bucket for tradesperson work photos (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gallery',
  'gallery',
  true,
  5242880, -- 5MB max
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

-- Avatars bucket for profile photos (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152, -- 2MB max
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

-- Documents bucket for estimate PDFs and uploads (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  10485760, -- 10MB max
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
);

-- Gallery: authenticated users can upload to their own folder
CREATE POLICY "Users can upload gallery images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'gallery'
  AND array_length(storage.foldername(name), 1) > 0
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Gallery: public read access
CREATE POLICY "Gallery images are publicly readable"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'gallery'
);

-- Gallery: users can delete own images
CREATE POLICY "Users can delete own gallery images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'gallery'
  AND array_length(storage.foldername(name), 1) > 0
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Avatars: upload own, public read, delete own
CREATE POLICY "Users can upload own avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND array_length(storage.foldername(name), 1) > 0
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Avatars are publicly readable"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'avatars'
);

CREATE POLICY "Users can delete own avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND array_length(storage.foldername(name), 1) > 0
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Documents: private — only owner can read/write
CREATE POLICY "Users can upload own documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND array_length(storage.foldername(name), 1) > 0
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can read own documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND array_length(storage.foldername(name), 1) > 0
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND array_length(storage.foldername(name), 1) > 0
  AND (storage.foldername(name))[1] = auth.uid()::text
);
