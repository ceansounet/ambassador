import sql from "@/lib/database/client";

export async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      hca_id TEXT UNIQUE NOT NULL,
      email TEXT,
      display_name TEXT NOT NULL,
      hca_first_name TEXT,
      hca_last_name TEXT,
      hca_street_address TEXT,
      hca_locality TEXT,
      hca_region TEXT,
      hca_postal_code TEXT,
      hca_country TEXT,
      slack_id TEXT,
      slack_name TEXT,
      slack_avatar_url TEXT,
      verification_status TEXT,
      is_admin BOOLEAN NOT NULL DEFAULT FALSE,
      last_ip TEXT,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      city TEXT,
      region TEXT,
      country_code TEXT,
      country_name TEXT,
      postal_code TEXT,
      timezone TEXT,
      org TEXT,
      balance_cents INTEGER NOT NULL DEFAULT 0,
      permanently_rejected_at TIMESTAMPTZ,
      permanent_rejection_note TEXT,
      geocoded_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'Pending Review',
      name TEXT,
      applicant_email TEXT,
      applicant_slack_id TEXT,
      applicant_hca_id TEXT,
      applicant_phone TEXT,
      date_of_birth DATE,
      address_line_1 TEXT,
      address_line_2 TEXT,
      address_city TEXT,
      address_state TEXT,
      address_zip TEXT,
      address_country TEXT,
      tshirt_size TEXT,
      bio TEXT,
      headshot_attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
      github_url TEXT,
      portfolio_url TEXT,
      application_first_thing_do TEXT,
      application_best_place_poster TEXT,
      idv_status TEXT,
      tshirt_shipped BOOLEAN NOT NULL DEFAULT FALSE,
      field_3 TEXT,
      field_4 TEXT,
      field_5 TEXT,
      field_6 TEXT,
      submitted_ip TEXT,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      city TEXT,
      region TEXT,
      country_code TEXT,
      country_name TEXT,
      decision_note TEXT,
      rejection_reason TEXT,
      reviewed_at TIMESTAMPTZ,
      reviewed_by TEXT REFERENCES users(id),
      airtable_record_id TEXT,
      airtable_created_time TIMESTAMPTZ,
      airtable_last_synced_at TIMESTAMPTZ,
      airtable_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      geocoded_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS hca_first_name TEXT
  `;
  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS hca_last_name TEXT
  `;
  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS hca_street_address TEXT
  `;
  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS hca_locality TEXT
  `;
  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS hca_region TEXT
  `;
  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS hca_postal_code TEXT
  `;
  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS hca_country TEXT
  `;
  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS slack_name TEXT
  `;
  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS slack_avatar_url TEXT
  `;
  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS permanently_rejected_at TIMESTAMPTZ
  `;
  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS permanent_rejection_note TEXT
  `;
  await sql`
    ALTER TABLE applications
    ALTER COLUMN user_id DROP NOT NULL
  `;
  await sql`
    ALTER TABLE applications
    ALTER COLUMN status SET DEFAULT 'Pending Review'
  `;
  await sql`
    ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS applicant_email TEXT
  `;
  await sql`
    ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS applicant_slack_id TEXT
  `;
  await sql`
    ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS applicant_hca_id TEXT
  `;
  await sql`
    ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS applicant_phone TEXT
  `;
  await sql`
    ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS address_line_1 TEXT
  `;
  await sql`
    ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS address_line_2 TEXT
  `;
  await sql`
    ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS address_city TEXT
  `;
  await sql`
    ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS address_state TEXT
  `;
  await sql`
    ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS address_zip TEXT
  `;
  await sql`
    ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS address_country TEXT
  `;
  await sql`
    ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS tshirt_size TEXT
  `;
  await sql`
    ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS bio TEXT
  `;
  await sql`
    ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS headshot_attachments JSONB NOT NULL DEFAULT '[]'::jsonb
  `;
  await sql`
    ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS github_url TEXT
  `;
  await sql`
    ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS portfolio_url TEXT
  `;
  await sql`
    ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS application_first_thing_do TEXT
  `;
  await sql`
    ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS application_best_place_poster TEXT
  `;
  await sql`
    ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS idv_status TEXT
  `;
  await sql`
    ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS tshirt_shipped BOOLEAN NOT NULL DEFAULT FALSE
  `;
  await sql`
    ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS decision_note TEXT
  `;
  await sql`
    ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT
  `;
  await sql`
    ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ
  `;
  await sql`
    ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS reviewed_by TEXT REFERENCES users(id)
  `;
  await sql`
    ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS airtable_record_id TEXT
  `;
  await sql`
    ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS airtable_created_time TIMESTAMPTZ
  `;
  await sql`
    ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS airtable_last_synced_at TIMESTAMPTZ
  `;
  await sql`
    ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS airtable_payload JSONB NOT NULL DEFAULT '{}'::jsonb
  `;

  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS balance_cents INTEGER NOT NULL DEFAULT 0
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'pending',
      details JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ip_visits (
      id TEXT PRIMARY KEY,
      ip TEXT NOT NULL,
      user_id TEXT REFERENCES users(id),
      visit_type TEXT NOT NULL,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      city TEXT,
      region TEXT,
      country_code TEXT,
      country_name TEXT,
      postal_code TEXT,
      timezone TEXT,
      org TEXT,
      geocoded_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS poster_groups (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      campaign_slug TEXT NOT NULL,
      name TEXT,
      poster_count INTEGER NOT NULL DEFAULT 0,
      charset TEXT NOT NULL DEFAULT 'alphanumeric',
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS posters (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      poster_group_id TEXT REFERENCES poster_groups(id) ON DELETE SET NULL,
      campaign_slug TEXT NOT NULL,
      qr_code_token TEXT NOT NULL,
      referral_code TEXT NOT NULL,
      poster_type TEXT NOT NULL DEFAULT 'color',
      verification_status TEXT NOT NULL DEFAULT 'pending',
      verified_at TIMESTAMPTZ,
      rejection_reason TEXT,
      location_description TEXT,
      proof_path TEXT,
      proof_original_name TEXT,
      proof_content_type TEXT,
      proof_size_bytes BIGINT,
      detected_qr_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      submitted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS poster_scans (
      id TEXT PRIMARY KEY,
      poster_id TEXT NOT NULL REFERENCES posters(id) ON DELETE CASCADE,
      ip_address TEXT,
      user_agent TEXT,
      referrer TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_ip_visits_ip ON ip_visits(ip)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_ip_visits_user_id ON ip_visits(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_ip_visits_visit_type ON ip_visits(visit_type)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status)`;
  await sql`DROP INDEX IF EXISTS idx_applications_airtable_record_id`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_airtable_record_id ON applications(airtable_record_id) WHERE airtable_record_id IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_applications_applicant_email ON applications(applicant_email)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_applications_applicant_slack_id ON applications(applicant_slack_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_applications_applicant_hca_id ON applications(applicant_hca_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_users_hca_id ON users(hca_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_poster_groups_user_id ON poster_groups(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_poster_groups_campaign_slug ON poster_groups(campaign_slug)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_posters_user_id ON posters(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_posters_group_id ON posters(poster_group_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_posters_campaign_slug ON posters(campaign_slug)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_posters_status ON posters(verification_status)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_posters_qr_code_token ON posters(qr_code_token)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_posters_referral_code ON posters(referral_code)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_poster_scans_poster_id ON poster_scans(poster_id)`;

  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS hca_addresses JSONB NOT NULL DEFAULT '[]'::jsonb
  `;
  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS selected_address_index INTEGER NOT NULL DEFAULT 0
  `;
  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS ambassador_region TEXT
  `;
}
