-- Kullanıcı ID '2ee754ed-f7d5-4a23-9feb-eb0c5a8d6316' olan hesaba admin rolü atama
INSERT INTO public.user_roles (user_id, role)
VALUES ('2ee754ed-f7d5-4a23-9feb-eb0c5a8d6316', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Kontrol sorgusu
SELECT * FROM public.user_roles WHERE user_id = '2ee754ed-f7d5-4a23-9feb-eb0c5a8d6316';
