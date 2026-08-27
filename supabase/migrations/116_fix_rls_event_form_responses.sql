-- RLS politikasını guest kullanıcılar için güncelle
-- Auth olmayan kullanıcılar da form gönderebilsin

-- Mevcut politikayı sil ve yeniden oluştur
DROP POLICY IF EXISTS "Public insert" ON public.event_form_responses;

-- Herkes form gönderebilir (public insert)
CREATE POLICY "Public insert" ON public.event_form_responses
  FOR INSERT WITH CHECK (true);
