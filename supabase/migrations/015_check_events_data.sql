-- Events tablosu kontrolü
SELECT COUNT(*) as events_count FROM events WHERE is_active = true;

-- Events sample data
SELECT id, title, date, time, venue, location, category, price_from, image_url, is_active
FROM events 
WHERE is_active = true 
ORDER BY date ASC 
LIMIT 5;

-- Tour events kontrolü
SELECT COUNT(*) as tour_events_count FROM tour_events;

-- Tour events sample data
SELECT te.*, a.name as artist_name
FROM tour_events te
JOIN artists a ON te.artist_id = a.id
ORDER BY te.event_date ASC 
LIMIT 5;
