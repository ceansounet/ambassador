ALTER TABLE users
ADD COLUMN IF NOT EXISTS manual_dashboard_state TEXT;
