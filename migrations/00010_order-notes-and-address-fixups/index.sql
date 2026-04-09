ALTER TABLE orders
ADD COLUMN IF NOT EXISTS note TEXT;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS internal_fail_reason TEXT;

UPDATE orders
SET note = COALESCE(note, rejection_note)
WHERE status IN ('rejected', 'cancelled')
  AND rejection_note IS NOT NULL;

UPDATE orders
SET internal_fail_reason = COALESCE(internal_fail_reason, rejection_note)
WHERE status = 'failed'
  AND rejection_note IS NOT NULL;

UPDATE orders
SET address = (address #>> '{}')::jsonb
WHERE jsonb_typeof(address) = 'string'
  AND address #>> '{}' LIKE '{%';
