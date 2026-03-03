-- Admin Kullanıcısı Oluştur
-- Supabase Dashboard > SQL Editor'da bu dosyayı çalıştırın

-- Admin kullanıcısı oluştur
-- Bu SQL ile doğrudan kullanıcı oluşturabiliriz
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  invited_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@bilet-ekosistemi.com',
  crypt('admin123', gen_salt('bf')),
  now(),
  NULL,
  NULL,
  NULL,
  '{"provider":"email","providers":["email"]}',
  '{}',
  false,
  now(),
  now()
);

-- Alternatif: Supabase Dashboard üzerinden manuel olarak oluşturmak daha kolay
-- Dashboard > Authentication > Users > Add user
-- Email: admin@bilet-ekosistemi.com
-- Password: admin123
-- Mark as confirmed: YES
