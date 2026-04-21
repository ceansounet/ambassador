ALTER TABLE applications
ADD COLUMN IF NOT EXISTS review_on_hold BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS applications_review_on_hold_idx
  ON applications (review_on_hold)
  WHERE review_on_hold IS TRUE;
