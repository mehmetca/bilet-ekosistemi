-- Anonim kullanıcıların artists tablosunu okumasına izin ver
CREATE POLICY "Enable read access for all users" ON artists
    FOR SELECT USING (true);

-- Anonim kullanıcıların tour_events tablosunu okumasına izin ver
CREATE POLICY "Enable read access for all users" ON tour_events
    FOR SELECT USING (true);

-- RLS'i etkinleştir (eğer devre dışı bırakmak istemiyorsanız)
ALTER TABLE artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_events ENABLE ROW LEVEL SECURITY;

-- Kontrol et
SELECT * FROM artists WHERE slug = 'mem-ararat';
