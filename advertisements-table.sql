-- Advertisements table for banner management
CREATE TABLE IF NOT EXISTS advertisements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  image_url TEXT,
  link_url TEXT NOT NULL,
  placement TEXT NOT NULL DEFAULT 'news_slider',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_advertisements_placement ON advertisements(placement);
CREATE INDEX IF NOT EXISTS idx_advertisements_is_active ON advertisements(is_active);
CREATE INDEX IF NOT EXISTS idx_advertisements_created_at ON advertisements(created_at);

-- Disable RLS for now to avoid permission issues
ALTER TABLE advertisements DISABLE ROW LEVEL SECURITY;

-- Insert sample advertisement for testing
INSERT INTO advertisements (title, image_url, link_url, placement, is_active) VALUES
('Sample Banner', 'https://via.placeholder.com/800x128', 'https://example.com', 'news_slider', true)
ON CONFLICT DO NOTHING;
