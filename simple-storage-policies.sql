-- Simple storage policies without complex auth checks
-- Run this after creating buckets

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Advertisements images are publicly viewable" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload advertisements" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own advertisements" ON storage.objects;

-- Simple policies for advertisements bucket
CREATE POLICY "Advertisements images are publicly viewable" ON storage.objects
  FOR SELECT USING (bucket_id = 'advertisements');

CREATE POLICY "Anyone can upload advertisements" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'advertisements');

CREATE POLICY "Anyone can update advertisements" ON storage.objects
  FOR UPDATE USING (bucket_id = 'advertisements');

-- Similar simple policies for other buckets
DROP POLICY IF EXISTS "Event images are publicly viewable" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload event images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own event images" ON storage.objects;

CREATE POLICY "Event images are publicly viewable" ON storage.objects
  FOR SELECT USING (bucket_id = 'event-images');

CREATE POLICY "Anyone can upload event images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'event-images');

CREATE POLICY "Anyone can update event images" ON storage.objects
  FOR UPDATE USING (bucket_id = 'event-images');

DROP POLICY IF EXISTS "Tour event images are publicly viewable" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload tour event images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own tour event images" ON storage.objects;

CREATE POLICY "Tour event images are publicly viewable" ON storage.objects
  FOR SELECT USING (bucket_id = 'tour-events');

CREATE POLICY "Anyone can upload tour event images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'tour-events');

CREATE POLICY "Anyone can update tour event images" ON storage.objects
  FOR UPDATE USING (bucket_id = 'tour-events');

DROP POLICY IF EXISTS "Artist images are publicly viewable" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload artist images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update artist images" ON storage.objects;

CREATE POLICY "Artist images are publicly viewable" ON storage.objects
  FOR SELECT USING (bucket_id = 'artists');

CREATE POLICY "Anyone can upload artist images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'artists');

CREATE POLICY "Anyone can update artist images" ON storage.objects
  FOR UPDATE USING (bucket_id = 'artists');
