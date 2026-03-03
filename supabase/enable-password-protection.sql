-- Enable Leaked Password Protection in Supabase Auth
-- This script enables the HaveIBeenPwned.org password protection

-- 1. Check current auth configuration
SELECT 
  name,
  value
FROM auth.config 
WHERE name IN (
  'password_protection_enabled',
  'password_protection_provider',
  'external_password_providers_enabled'
);

-- 2. Enable leaked password protection
-- Note: This typically needs to be done via Supabase Dashboard or API
-- SQL approach may not work for all auth settings

-- Update auth configuration to enable password protection
UPDATE auth.config 
SET value = 'true' 
WHERE name = 'password_protection_enabled';

-- Enable HaveIBeenPwned.org as the provider
UPDATE auth.config 
SET value = 'haveibeenpwned' 
WHERE name = 'password_protection_provider';

-- 3. Verify the changes
SELECT 
  name,
  value,
  updated_at
FROM auth.config 
WHERE name IN (
  'password_protection_enabled',
  'password_protection_provider',
  'external_password_providers_enabled'
);

-- 4. Alternative: Manual configuration instructions
/*
To enable leaked password protection via Supabase Dashboard:

1. Go to Supabase Dashboard
2. Navigate to Authentication > Settings
3. Find "Password Protection" section
4. Enable "Protect against leaked passwords"
5. Select "HaveIBeenPwned.org" as provider
6. Save changes

Or via Supabase CLI:
supabase auth update --password-protection-enabled=true --password-protection-provider=haveibeenpwned
*/
