-- Disable RLS for storage buckets to fix permission issues
-- Run this after creating buckets

-- Disable RLS for storage.objects table
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies to avoid conflicts
DROP POLICY IF EXISTS "Advertisements images are publicly viewable" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload advertisements" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update advertisements" ON storage.objects;

DROP POLICY IF EXISTS "Event images are publicly viewable" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload event images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update event images" ON storage.objects;

DROP POLICY IF EXISTS "Tour event images are publicly viewable" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload tour event images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update tour event images" ON storage.objects;

DROP POLICY IF EXISTS "Artist images are publicly viewable" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload artist images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update artist images" ON storage.objects;

-- Enable RLS back but with no policies (public access)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create simple public policies
CREATE POLICY "Public access to storage objects" ON storage.objects
  FOR ALL USING (true);

-- Alternative: Completely disable RLS for storage
-- ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
