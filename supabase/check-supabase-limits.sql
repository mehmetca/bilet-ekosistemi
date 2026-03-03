-- Supabase limit ve performans analizi

-- 1. Veritabanı bağlantı limitleri
SELECT 
  setting as max_connections,
  current_setting('max_connections') as current_max
FROM pg_settings 
WHERE name = 'max_connections';

-- 2. Aktif bağlantıları kontrol et
SELECT 
  count(*) as total_connections,
  count(*) FILTER (WHERE state = 'active') as active_connections,
  count(*) FILTER (WHERE state = 'idle') as idle_connections,
  count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
FROM pg_stat_activity 
WHERE datname = current_database();

-- 3. En uzun süren sorgular
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  rows
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- 4. Tablo boyutları
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
  pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY size_bytes DESC;

-- 5. Index kullanım istatistikleri
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes 
ORDER BY idx_scan DESC;

-- 6. Supabase storage kullanımı
SELECT 
  bucket_id,
  bucket_name,
  file_size,
  file_name,
  created_at
FROM storage.objects 
ORDER BY file_size DESC 
LIMIT 10;

-- 7. Son 24 saatteki sipariş sayısı
SELECT 
  count(*) as orders_24h,
  sum(total_price) as total_revenue_24h
FROM public.orders 
WHERE created_at >= NOW() - INTERVAL '24 hours';

-- 8. Hata oranını kontrol et (eğer log tablosu varsa)
-- Bu sorgu logs tablosu varsa çalışır
SELECT 
  level,
  count(*) as error_count,
  max(timestamp) as last_occurrence
FROM logs 
WHERE timestamp >= NOW() - INTERVAL '24 hours'
  AND level IN ('ERROR', 'FATAL')
GROUP BY level;

-- 9. Cache hit oranı
SELECT 
  sum(heap_blks_read) as heap_reads,
  sum(heap_blks_hit) as heap_hits,
  sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) * 100 as cache_hit_ratio
FROM pg_stat_database 
WHERE datname = current_database();

-- 10. Lock durumunu kontrol et
SELECT 
  t.relname as table_name,
  l.locktype,
  l.mode,
  l.granted,
  a.query,
  a.query_start,
  a.state
FROM pg_locks l
JOIN pg_class t ON l.relation = t.oid
JOIN pg_stat_activity a ON l.pid = a.pid
WHERE t.relname = 'orders'
  AND NOT l.granted;
