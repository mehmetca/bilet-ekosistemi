-- Admin Şifresini Güncelle
-- Supabase Dashboard > SQL Editor'da bu dosyayı çalıştırın

-- Mevcut admin kullanıcısının şifresini güncelle
UPDATE auth.users 
SET encrypted_password = crypt('admin123', gen_salt('bf')),
    updated_at = now()
WHERE email = 'admin@bilet-ekosistemi.com';

-- Alternatif: Supabase Dashboard üzerinden güncellemek daha kolay
-- Dashboard > Authentication > Users > admin@bilet-ekosistemi.com > Reset Password
-- New Password: admin123
-- Send password reset email: NO (kapalı bırak)
-- Save
