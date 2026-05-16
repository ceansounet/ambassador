ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_stardance_referral_code_format;

ALTER TABLE stardance_referral_codes
  DROP CONSTRAINT IF EXISTS stardance_referral_codes_code_format;

UPDATE users
SET stardance_referral_code = LOWER(stardance_referral_code)
WHERE stardance_referral_code IS NOT NULL;

UPDATE stardance_referral_codes
SET code = LOWER(code);

UPDATE posters
SET referral_code = LOWER(referral_code)
WHERE referral_code ~ '^[A-Z0-9]{5}$';

ALTER TABLE users
  ADD CONSTRAINT users_stardance_referral_code_format
    CHECK (stardance_referral_code IS NULL OR stardance_referral_code ~ '^[a-z0-9]{5}$');

ALTER TABLE stardance_referral_codes
  ADD CONSTRAINT stardance_referral_codes_code_format
    CHECK (code ~ '^[a-z0-9]{5}$');
