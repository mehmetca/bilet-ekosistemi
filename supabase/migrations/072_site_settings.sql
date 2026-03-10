-- Site ayarları (key-value). Maksimum bilet adedi vb.
CREATE TABLE IF NOT EXISTS site_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT 'null'
);

-- Varsayılan: sipariş başına en fazla 10 bilet
INSERT INTO site_settings (key, value)
VALUES ('max_ticket_quantity', '10')
ON CONFLICT (key) DO NOTHING;

-- RLS: herkes okuyabilir (public okuma), sadece admin yazabilir
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read site_settings"
  ON site_settings FOR SELECT
  USING (true);

CREATE POLICY "Admin update site_settings"
  ON site_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

COMMENT ON TABLE site_settings IS 'Genel site ayarları (max_ticket_quantity vb.)';
