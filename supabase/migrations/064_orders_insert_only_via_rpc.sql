-- Bilet satın alma mutlaka RPC (reserve_tickets_and_create_order) ile yapılmalı.
-- Overselling önleme: Doğrudan orders INSERT'ı kapatılıyor; sadece RPC ile sipariş oluşturulabilir.

-- Kullanıcıların orders tablosuna doğrudan INSERT yapmasını kaldır.
-- Sipariş oluşturma sadece reserve_tickets_and_create_order RPC ile (FOR UPDATE + stok azaltma) yapılır.
DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;

-- Not: RPC SECURITY DEFINER ile çalıştığı için RLS'den muaf; API (service_role) RPC'yi çağırarak
-- satın alma yapar. Anon/authenticated doğrudan orders.insert yapamaz, overselling bu yolla engellenir.
