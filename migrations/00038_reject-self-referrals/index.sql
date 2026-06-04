-- Reject self-referrals: a referral whose contact is the ambassador's own email
-- or Slack id is not a real referral. Going forward the feed sync rejects these
-- on ingest, but ones that already slipped through (some already verified and
-- paid) need a one-time cleanup. The balance trigger on stardance_referrals
-- claws back the $0.50 credit for any that were verified.
UPDATE stardance_referrals AS referral
SET verification_status = 'rejected'
FROM users AS owner
WHERE owner.id = referral.user_id
  AND referral.verification_status <> 'rejected'
  AND (
    (owner.email IS NOT NULL AND referral.email <> '' AND LOWER(referral.email) = LOWER(owner.email))
    OR (owner.slack_id IS NOT NULL AND owner.slack_id <> '' AND referral.slack_id = owner.slack_id)
  );
