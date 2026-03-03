-- Test the fixed function with NULL values
SELECT public.simple_insert_order(
  '21ef512d-a0b1-4c38-8dad-49b657957b26',
  '73c8a6ab-5d97-478c-93af-09bac8e42872', 
  1,
  25.00,
  'BLT-TEST456',
  'pending',
  NULL,
  NULL
);
