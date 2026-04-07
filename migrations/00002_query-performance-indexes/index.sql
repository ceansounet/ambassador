CREATE INDEX IF NOT EXISTS idx_users_created_at_desc
  ON users(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_users_slack_id_updated_created_desc
  ON users(slack_id, updated_at DESC, created_at DESC)
  WHERE slack_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_email_lower_updated_created_desc
  ON users(LOWER(email), updated_at DESC, created_at DESC)
  WHERE email IS NOT NULL;

DROP INDEX IF EXISTS idx_users_hca_id;

CREATE INDEX IF NOT EXISTS idx_applications_user_created_id_desc
  ON applications(user_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_applications_created_id_desc
  ON applications(created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_applications_applicant_email_lower
  ON applications(LOWER(applicant_email))
  WHERE applicant_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ip_visits_created_at_desc
  ON ip_visits(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ip_visits_user_created_desc
  ON ip_visits(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ip_visits_user_visit_type_created_desc
  ON ip_visits(user_id, visit_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ip_visits_ip_visit_type_created_desc
  ON ip_visits(ip, visit_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ip_visits_anonymous_unlinked_ip
  ON ip_visits(ip)
  WHERE user_id IS NULL AND visit_type = 'anonymous';

CREATE INDEX IF NOT EXISTS idx_orders_user_created_desc
  ON orders(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_poster_groups_user_created_desc
  ON poster_groups(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_posters_user_created_desc
  ON posters(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_posters_group_created_asc
  ON posters(poster_group_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_posters_user_status_campaign_created_asc
  ON posters(user_id, verification_status, campaign_slug, created_at ASC);
