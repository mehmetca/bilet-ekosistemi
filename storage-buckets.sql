-- Create storage buckets for image uploads
-- Run this in Supabase SQL Editor

-- Advertisements bucket for banner images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'advertisements', 
  'advertisements', 
  true, 
  5242880, -- 5MB in bytes
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Event images bucket (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-images', 
  'event-images', 
  true, 
  5242880, -- 5MB in bytes
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Tour events bucket (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tour-events', 
  'tour-events', 
  true, 
  5242880, -- 5MB in bytes
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Artists bucket (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'artists', 
  'artists', 
  true, 
  5242880, -- 5MB in bytes
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Add RLS policies for storage buckets
-- Policy for public read access to advertisements
CREATE POLICY "Advertisements images are publicly viewable" ON storage.objects
  FOR SELECT USING (bucket_id = 'advertisements');

-- Policy for authenticated users to upload to advertisements
CREATE POLICY "Authenticated users can upload advertisements" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'advertisements' AND 
    auth.role() = 'authenticated'
  );

-- Policy for users to update their own advertisement images
CREATE POLICY "Users can update their own advertisements" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'advertisements' AND 
    auth.role() = 'authenticated'
  );

-- Similar policies for other buckets
CREATE POLICY "Event images are publicly viewable" ON storage.objects
  FOR SELECT USING (bucket_id = 'event-images');

CREATE POLICY "Authenticated users can upload event images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'event-images' AND 
    auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update their own event images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'event-images' AND 
    auth.role() = 'authenticated'
  );

CREATE POLICY "Tour event images are publicly viewable" ON storage.objects
  FOR SELECT USING (bucket_id = 'tour-events');

CREATE POLICY "Authenticated users can upload tour event images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'tour-events' AND 
    auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update their own tour event images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'tour-events' AND 
    auth.role() = 'authenticated'
  );

CREATE POLICY "Artist images are publicly viewable" ON storage.objects
  FOR SELECT USING (bucket_id = 'artists');

CREATE POLICY "Authenticated users can upload artist images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'artists' AND 
    auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update their own artist images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'artists' AND 
    auth.role() = 'authenticated'
  );
