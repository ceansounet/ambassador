-- The ambassador transaction history is a running-balance ledger: every
-- payout_balance_events row carries balance_after_cents, stamped by the BEFORE
-- INSERT trigger in the exact order events were applied. But the history was
-- ordered by (created_at, id), and id is a random UUID, so events that share a
-- timestamp (the 00034 backfill inserted a whole inventory at once, and
-- anything applied in the same instant collides) came back in arbitrary order.
-- That scrambled the running balance the ambassador reads top to bottom. Add a
-- monotonic sequence that reflects true insert order and order the history by it.

ALTER TABLE payout_balance_events
  ADD COLUMN IF NOT EXISTS seq BIGINT;

-- Number existing rows in their visible running-balance order. NOW() is the
-- transaction clock, so a batch of events from one transaction (a bulk verify,
-- a bulk un-verify, the 00034 backfill) all share created_at; the random-uuid
-- tiebreak is exactly what scrambled them. balance_after_cents was stamped in
-- apply order, so within a same-timestamp batch it reconstructs the chain — but
-- the direction depends on the sign: a credit batch climbs (balance_after ASC),
-- a debit batch falls (balance_after DESC). Flipping the key by sign sorts
-- either kind back into true apply order; id is the final deterministic
-- tiebreak. Every new row from here on gets a strictly increasing seq from the
-- sequence default below.
WITH ordered AS (
  SELECT id, row_number() OVER (
    ORDER BY created_at,
             CASE WHEN amount_cents < 0 THEN -balance_after_cents ELSE balance_after_cents END,
             id
  ) AS rn
  FROM payout_balance_events
)
UPDATE payout_balance_events e
SET seq = ordered.rn
FROM ordered
WHERE ordered.id = e.id AND e.seq IS NULL;

CREATE SEQUENCE IF NOT EXISTS payout_balance_events_seq
  OWNED BY payout_balance_events.seq;

SELECT setval(
  'payout_balance_events_seq',
  COALESCE((SELECT MAX(seq) FROM payout_balance_events), 0) + 1,
  false
);

ALTER TABLE payout_balance_events
  ALTER COLUMN seq SET DEFAULT nextval('payout_balance_events_seq');

ALTER TABLE payout_balance_events
  ALTER COLUMN seq SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payout_balance_events_user_seq
  ON payout_balance_events(user_id, seq DESC);
