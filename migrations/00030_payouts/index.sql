CREATE TABLE IF NOT EXISTS payouts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'changes_required', 'rejected', 'approved')
  ),
  bank_transfer_method TEXT NOT NULL CHECK (bank_transfer_method IN ('wise', 'ach')),
  banking_institution_name TEXT NOT NULL,
  iban TEXT,
  account_number TEXT,
  routing_number TEXT,
  ambassador_notes TEXT,
  admin_comment TEXT,
  transfer_link TEXT,
  created_by_admin_id TEXT REFERENCES users(id),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (
      bank_transfer_method = 'wise'
      AND iban IS NOT NULL
      AND account_number IS NULL
      AND routing_number IS NULL
    )
    OR
    (
      bank_transfer_method = 'ach'
      AND iban IS NULL
      AND account_number IS NOT NULL
      AND routing_number IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_payouts_user_created_at ON payouts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payouts_status_created_at ON payouts(status, created_at DESC);

CREATE TABLE IF NOT EXISTS payout_balance_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  payout_id TEXT REFERENCES payouts(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents <> 0),
  reason TEXT NOT NULL,
  note TEXT,
  balance_after_cents INTEGER NOT NULL CHECK (balance_after_cents >= 0),
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payout_balance_events_user_created_at
  ON payout_balance_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payout_balance_events_payout_id
  ON payout_balance_events(payout_id);
