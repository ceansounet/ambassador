-- Manual payouts + an internal notes log on payouts.
--
-- A manual payout (created_by_admin_id IS NOT NULL) is a one-off transaction
-- an admin sets up directly: fixed amount, real banking details, same review
-- and approval flow, but nothing to do with the ambassador's balance, ledger,
-- or poster/referral line items.

-- 1. Manual payouts don't occupy the ambassador's one-pending-request slot;
--    only requested payouts contend for it.
DROP INDEX IF EXISTS idx_payouts_one_pending_per_user;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payouts_one_pending_per_user
  ON payouts (user_id)
  WHERE status = 'pending' AND created_by_admin_id IS NULL;

-- 2. A timestamped internal notes log admins can append to any payout,
--    whatever its status. Never shown to the ambassador.
CREATE TABLE IF NOT EXISTS payout_notes (
  id TEXT PRIMARY KEY,
  payout_id TEXT NOT NULL REFERENCES payouts(id) ON DELETE CASCADE,
  author_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payout_notes_payout_created_at
  ON payout_notes(payout_id, created_at DESC);
