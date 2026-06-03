CREATE OR REPLACE FUNCTION referral_balance_delete_sync() RETURNS TRIGGER AS $$
BEGIN
  IF COALESCE(OLD.verification_status, '') = 'verified'
    AND EXISTS (SELECT 1 FROM users WHERE id = OLD.user_id) THEN
    INSERT INTO payout_balance_events (id, user_id, amount_cents, reason)
    VALUES (gen_random_uuid()::text, OLD.user_id, -50, 'referral_unverified');
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_referral_balance_delete_sync ON stardance_referrals;
CREATE TRIGGER trg_referral_balance_delete_sync
  AFTER DELETE ON stardance_referrals
  FOR EACH ROW EXECUTE FUNCTION referral_balance_delete_sync();

CREATE OR REPLACE FUNCTION poster_balance_delete_sync() RETURNS TRIGGER AS $$
BEGIN
  IF COALESCE(OLD.verification_status, '') = 'success'
    AND EXISTS (SELECT 1 FROM users WHERE id = OLD.user_id) THEN
    INSERT INTO payout_balance_events (id, user_id, amount_cents, reason)
    VALUES (gen_random_uuid()::text, OLD.user_id, -100, 'poster_unverified');
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_poster_balance_delete_sync ON posters;
CREATE TRIGGER trg_poster_balance_delete_sync
  AFTER DELETE ON posters
  FOR EACH ROW EXECUTE FUNCTION poster_balance_delete_sync();
