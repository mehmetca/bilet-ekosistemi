-- Main slider ust yazi alanlari
ALTER TABLE advertisements
  ADD COLUMN IF NOT EXISTS overlay_title TEXT,
  ADD COLUMN IF NOT EXISTS overlay_day TEXT,
  ADD COLUMN IF NOT EXISTS overlay_month_year TEXT;

