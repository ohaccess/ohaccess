-- 052_protect_profile_billing_columns.sql
-- Stop agents changing their own plan, billing, team, or sponsor fields.
--
-- WHY: the profiles_update_own policy (migration 010) lets a signed-in agent
-- write ANY column of their own row with the public key. The dashboard only
-- ever sends display fields, but someone calling Supabase directly could set
-- tier = 'pro', gift themselves bonus_visitors, or make themselves a team
-- admin, and get paid features free.
--
-- WHAT THIS DOES: a trigger that, for browser requests only
-- (current_user 'authenticated' / 'anon'), puts the protected columns back to
-- their stored values on UPDATE and to safe starting values on INSERT.
-- Server routes (service_role), the Stripe webhook, admin tools, the signup
-- trigger (SECURITY DEFINER, runs as owner), and the SQL editor are unaffected.
--
-- Browser writes audited 2026-09-13, all still work:
--   • Save settings (app/dashboard/page.tsx saveSettings): display fields only
--   • Remove sponsor (SettingsPanel.tsx): sponsor_id → NULL, still allowed
--   • Fallback profile insert (page.tsx loadProfile): id, email, referral_source
-- Same pattern as protect_agent_verification_columns (migration 051).
--
-- Safe to re-run.

CREATE OR REPLACE FUNCTION protect_profile_billing_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.email := coalesce(auth.jwt() ->> 'email', NEW.email);
    NEW.tier := 'free';
    NEW.role := 'agent';
    NEW.bonus_visitors := 0;
    NEW.open_houses_used := 0;
    NEW.brokerage_id := NULL;
    NEW.sponsor_id := NULL;
    NEW.stripe_customer_id := NULL;
    NEW.stripe_subscription_id := NULL;
    NEW.subscription_status := NULL;
    NEW.billing_interval := NULL;
    NEW.current_period_end := NULL;
    NEW.subscription_canceled_at := NULL;
    NEW.signup_admin_notified_at := NULL;
    NEW.welcome_email_sent_at := NULL;
    NEW.drip_opt_out_at := NULL;
    NEW.drip_unsubscribe_token := gen_random_uuid();
    NEW.agreement_templates := NULL;
    NEW.created_at := now();
    RETURN NEW;
  END IF;

  NEW.id := OLD.id;
  NEW.email := OLD.email;
  NEW.tier := OLD.tier;
  NEW.role := OLD.role;
  NEW.bonus_visitors := OLD.bonus_visitors;
  NEW.open_houses_used := OLD.open_houses_used;
  NEW.brokerage_id := OLD.brokerage_id;
  -- An agent may REMOVE their sponsor, never add or switch one.
  IF NEW.sponsor_id IS NOT NULL THEN
    NEW.sponsor_id := OLD.sponsor_id;
  END IF;
  NEW.stripe_customer_id := OLD.stripe_customer_id;
  NEW.stripe_subscription_id := OLD.stripe_subscription_id;
  NEW.subscription_status := OLD.subscription_status;
  NEW.billing_interval := OLD.billing_interval;
  NEW.current_period_end := OLD.current_period_end;
  NEW.subscription_canceled_at := OLD.subscription_canceled_at;
  NEW.referral_source := OLD.referral_source;
  NEW.referral_source_first_seen_at := OLD.referral_source_first_seen_at;
  NEW.signup_admin_notified_at := OLD.signup_admin_notified_at;
  NEW.welcome_email_sent_at := OLD.welcome_email_sent_at;
  NEW.drip_unsubscribe_token := OLD.drip_unsubscribe_token;
  NEW.drip_opt_out_at := OLD.drip_opt_out_at;
  -- Written only by /api/agreement-templates (service role): stored file
  -- paths must not be pointed at another agent's uploads.
  NEW.agreement_templates := OLD.agreement_templates;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_billing_columns ON profiles;
CREATE TRIGGER protect_profile_billing_columns
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_profile_billing_columns();
