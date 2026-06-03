-- Payouts ledger + 3-state machine + event-sourced balance.
--
-- This migration rebuilds the balance model so that an ambassador's
-- `users.balance_cents` is an *event-sourced* value: every change to it is a
-- row in `payout_balance_events`, and a trigger keeps the cached column in
-- sync. Posters and referrals credit/claw back the ledger via triggers, so the
-- poster-proof and referral code paths stay completely untouched.
--
-- Rates: $1.00 per verified poster, $0.50 per verified referral.

-- 1. Feature flag. Ships dark (disabled); admins flip it on per-user or
--    globally from the safeguards screen when ready.
INSERT INTO app_safeguards (key, enabled)
VALUES ('payouts_enabled', FALSE)
ON CONFLICT (key) DO NOTHING;

-- 2. Allow debt: drop the non-negative guard on the ledger so a clawback after
--    a payout can push a balance negative.
ALTER TABLE payout_balance_events
  DROP CONSTRAINT IF EXISTS payout_balance_events_balance_after_cents_check;

-- 3. Public + private reasons on ledger events. `note` is the private/internal
--    reason (admins only); `public_note` is shown to the ambassador.
ALTER TABLE payout_balance_events
  ADD COLUMN IF NOT EXISTS public_note TEXT;

-- 4. Collapse the payout state machine to the three states we actually use.
UPDATE payouts SET status = 'pending' WHERE status = 'changes_required';
ALTER TABLE payouts DROP CONSTRAINT IF EXISTS payouts_status_check;
ALTER TABLE payouts
  ADD CONSTRAINT payouts_status_check CHECK (status IN ('pending', 'rejected', 'approved'));

-- 5. Public comment on a payout (shown to the ambassador). `admin_comment`
--    stays as the private/internal review comment.
ALTER TABLE payouts
  ADD COLUMN IF NOT EXISTS public_comment TEXT;

-- 5b. At most one pending payout per ambassador. The service checks this too,
--     but the partial unique index makes the database the final word.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payouts_one_pending_per_user
  ON payouts (user_id)
  WHERE status = 'pending';

-- 6. Payout line-items: the posters and referrals that compose a payout,
--    snapshotted when the payout is requested. `amount_cents` freezes the rate
--    that applied at request time.
CREATE TABLE IF NOT EXISTS payout_posters (
  payout_id TEXT NOT NULL REFERENCES payouts(id) ON DELETE CASCADE,
  poster_id TEXT NOT NULL REFERENCES posters(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (payout_id, poster_id)
);
CREATE INDEX IF NOT EXISTS idx_payout_posters_poster ON payout_posters(poster_id);

CREATE TABLE IF NOT EXISTS payout_referrals (
  payout_id TEXT NOT NULL REFERENCES payouts(id) ON DELETE CASCADE,
  referral_id TEXT NOT NULL REFERENCES stardance_referrals(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (payout_id, referral_id)
);
CREATE INDEX IF NOT EXISTS idx_payout_referrals_referral ON payout_referrals(referral_id);

-- 7. The single source of truth: applying a ledger event mutates the cached
--    balance and stamps the running total. Created BEFORE the backfill below so
--    backfilled rows accumulate correctly.
CREATE OR REPLACE FUNCTION payout_balance_event_apply() RETURNS TRIGGER AS $$
DECLARE
  next_balance INTEGER;
BEGIN
  UPDATE users
  SET balance_cents = balance_cents + NEW.amount_cents,
      updated_at = NOW()
  WHERE id = NEW.user_id
  RETURNING balance_cents INTO next_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payout_balance_events references unknown user_id %', NEW.user_id;
  END IF;

  NEW.balance_after_cents := next_balance;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payout_balance_event_apply ON payout_balance_events;
CREATE TRIGGER trg_payout_balance_event_apply
  BEFORE INSERT ON payout_balance_events
  FOR EACH ROW EXECUTE FUNCTION payout_balance_event_apply();

-- 8. Backfill: credit every already-verified poster ($1) and referral ($0.50).
--    These INSERTs fire the trigger above, so balances accumulate from the
--    existing verified inventory.
INSERT INTO payout_balance_events (id, user_id, amount_cents, reason, created_at)
SELECT gen_random_uuid()::text, p.user_id, 100, 'poster_verified',
       COALESCE(p.verified_at, p.updated_at, NOW())
FROM posters p
WHERE p.verification_status = 'success';

INSERT INTO payout_balance_events (id, user_id, amount_cents, reason, created_at)
SELECT gen_random_uuid()::text, r.user_id, 50, 'referral_verified',
       COALESCE(r.referred_at, r.created_at, NOW())
FROM stardance_referrals r
WHERE r.verification_status = 'verified';

-- 9. Keep the ledger in sync going forward. A poster entering 'success' credits
--    $1; leaving 'success' claws it back. Same shape for referrals at $0.50.
CREATE OR REPLACE FUNCTION poster_balance_sync() RETURNS TRIGGER AS $$
DECLARE
  was_verified BOOLEAN := FALSE;
  is_verified BOOLEAN := (NEW.verification_status = 'success');
BEGIN
  IF TG_OP = 'UPDATE' THEN
    was_verified := (COALESCE(OLD.verification_status, '') = 'success');
  END IF;

  IF is_verified AND NOT was_verified THEN
    INSERT INTO payout_balance_events (id, user_id, amount_cents, reason)
    VALUES (gen_random_uuid()::text, NEW.user_id, 100, 'poster_verified');
  ELSIF was_verified AND NOT is_verified THEN
    INSERT INTO payout_balance_events (id, user_id, amount_cents, reason)
    VALUES (gen_random_uuid()::text, NEW.user_id, -100, 'poster_unverified');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_poster_balance_sync ON posters;
CREATE TRIGGER trg_poster_balance_sync
  AFTER INSERT OR UPDATE OF verification_status ON posters
  FOR EACH ROW EXECUTE FUNCTION poster_balance_sync();

CREATE OR REPLACE FUNCTION referral_balance_sync() RETURNS TRIGGER AS $$
DECLARE
  was_verified BOOLEAN := FALSE;
  is_verified BOOLEAN := (NEW.verification_status = 'verified');
BEGIN
  IF TG_OP = 'UPDATE' THEN
    was_verified := (COALESCE(OLD.verification_status, '') = 'verified');
  END IF;

  IF is_verified AND NOT was_verified THEN
    INSERT INTO payout_balance_events (id, user_id, amount_cents, reason)
    VALUES (gen_random_uuid()::text, NEW.user_id, 50, 'referral_verified');
  ELSIF was_verified AND NOT is_verified THEN
    INSERT INTO payout_balance_events (id, user_id, amount_cents, reason)
    VALUES (gen_random_uuid()::text, NEW.user_id, -50, 'referral_unverified');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_referral_balance_sync ON stardance_referrals;
CREATE TRIGGER trg_referral_balance_sync
  AFTER INSERT OR UPDATE OF verification_status ON stardance_referrals
  FOR EACH ROW EXECUTE FUNCTION referral_balance_sync();
