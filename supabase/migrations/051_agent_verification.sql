-- 051_agent_verification.sql
-- One-time agent verification before publishing open houses (lib/agent-verification.ts).
--
-- WHY: anyone can create an ohACCESS account. A non-agent could use it to
-- collect strangers' names and phone numbers and have our Twilio number text
-- them. From now on an agent verifies a mobile number by texted code (and
-- gives their licence number where their country requires one) before the
-- database will accept their first open house.
--
-- WHAT THIS DOES:
--   1. profiles.agent_verified_at / verified_phone / verified_phone_line_type
--   2. agent_phone_codes: the pending texted code (hashed), service-role only
--   3. Grandfathers every agent who already has an open house (live or
--      archived) or belongs to a team. Nobody using ohACCESS today is blocked.
--   4. A trigger stops agents setting the new profile columns themselves (the
--      profiles_update_own policy lets an agent write any column of their row)
--   5. A trigger refuses open_houses inserts from unverified agents
--
-- ORDER: deploy the code first, then run this. The dashboard ignores
-- verification until these columns exist.
--
-- Safe to re-run.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS agent_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_phone text,             -- E.164
  ADD COLUMN IF NOT EXISTS verified_phone_line_type text;   -- Twilio Lookup type

-- One ohACCESS account per verified phone.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_verified_phone_unique
  ON profiles (verified_phone)
  WHERE verified_phone IS NOT NULL;

CREATE TABLE IF NOT EXISTS agent_phone_codes (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  phone_e164 text NOT NULL,
  code_hash text NOT NULL,
  channel text NOT NULL DEFAULT 'sms',
  line_type text,
  attempts int NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- RLS on with no policies: only API routes (service role) touch it.
ALTER TABLE agent_phone_codes ENABLE ROW LEVEL SECURITY;

-- Grandfather existing agents (runs before the protect trigger exists).
UPDATE profiles p
SET agent_verified_at = now()
WHERE p.agent_verified_at IS NULL
  AND (
    p.brokerage_id IS NOT NULL
    OR EXISTS (SELECT 1 FROM open_houses oh WHERE oh.agent_id = p.id)
    OR EXISTS (SELECT 1 FROM open_house_archive a WHERE a.agent_id = p.id)
  );

-- Agents can't write the verification columns. current_user is 'authenticated'
-- / 'anon' for browser requests; server routes run as 'service_role', and the
-- SQL editor as 'postgres'. Not SECURITY DEFINER, or current_user would
-- always be the owner.
CREATE OR REPLACE FUNCTION protect_agent_verification_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.agent_verified_at := NULL;
      NEW.verified_phone := NULL;
      NEW.verified_phone_line_type := NULL;
    ELSE
      NEW.agent_verified_at := OLD.agent_verified_at;
      NEW.verified_phone := OLD.verified_phone;
      NEW.verified_phone_line_type := OLD.verified_phone_line_type;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_agent_verification_columns ON profiles;
CREATE TRIGGER protect_agent_verification_columns
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_agent_verification_columns();

-- Unverified agents can't create open houses from the browser. The lookup
-- runs as the agent, so RLS limits it to their own profile row.
CREATE OR REPLACE FUNCTION require_verified_agent_for_open_house()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = NEW.agent_id AND p.agent_verified_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'AGENT_NOT_VERIFIED'
      USING HINT = 'Verify your mobile number before publishing an open house.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS require_verified_agent_for_open_house ON open_houses;
CREATE TRIGGER require_verified_agent_for_open_house
  BEFORE INSERT ON open_houses
  FOR EACH ROW EXECUTE FUNCTION require_verified_agent_for_open_house();
