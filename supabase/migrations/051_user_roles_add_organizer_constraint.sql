-- user_roles tablosundaki CHECK constraint sadece 'admin' ve 'controller' izin veriyordu.
-- 'organizer' rolü migration 037'de eklendi ama constraint güncellenmedi.
-- Bu migration: organizer rolünü constraint'e ekler.

ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;

ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_role_check
  CHECK (role IN ('admin', 'controller', 'organizer'));
