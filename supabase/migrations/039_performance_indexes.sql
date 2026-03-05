-- Performance indexes for faster queries
-- orders: used in admin, analytics, customer lookup
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_event_id ON orders (event_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_email ON orders (buyer_email);

-- user_profiles: Kundennummer lookup for admin müşteri ara
CREATE INDEX IF NOT EXISTS idx_user_profiles_kundennummer ON user_profiles (kundennummer);

-- events: slug and is_active for event detail page
CREATE INDEX IF NOT EXISTS idx_events_slug_active ON events (slug, is_active) WHERE is_active = true;
