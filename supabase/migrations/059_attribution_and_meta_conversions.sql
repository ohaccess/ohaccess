-- 059_attribution_and_meta_conversions.sql
-- Two small things for the growth work (HANDOFF.md items 6 and 7).
--
-- 1. UTM capture on signup (item 7). profiles gains utm_source, utm_medium,
--    utm_campaign, utm_content, utm_term and landing_page: the first-touch
--    link that brought the agent in (post, ad, outreach), captured by
--    RefCapture into a 30-day cookie, stashed on auth user_metadata at signup,
--    and copied onto the profile row by handle_new_user() below (same path
--    referral_source has used since migrations 004/005). The browser-side
--    profile auto-create and the service-role routes write the same columns.
--    The billing-protection trigger (052) learns the new columns so an agent
--    can set them at insert but never rewrite them afterwards.
--
-- 2. Meta conversion ledger (item 6). meta_registration_events (049) keyed
--    only by user_id and only served CompleteRegistration. The new
--    meta_conversion_events is keyed by (user_id, event_name) so the
--    FirstOpenHouse event gets the same at-most-once guarantee. Existing rows
--    are copied across; the old table is left in place for now and can be
--    dropped once the new one has been live for a while.
--
-- Safe to re-run: IF NOT EXISTS / CREATE OR REPLACE / ON CONFLICT DO NOTHING.

-- ── 1. profiles attribution columns ─────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS utm_campaign TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS utm_content TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS utm_term TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS landing_page TEXT;

CREATE INDEX IF NOT EXISTS profiles_utm_source_idx
  ON public.profiles(utm_source) WHERE utm_source IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_utm_campaign_idx
  ON public.profiles(utm_campaign) WHERE utm_campaign IS NOT NULL;

-- The auth → profiles trigger: copy the attribution the signup form stashed
-- on the auth user. Lengths capped to match lib/attribution's own limits.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    referral_source,
    referral_source_first_seen_at,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
    landing_page
  )
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'referral_source',
    CASE
      WHEN new.raw_user_meta_data->>'referral_source' IS NOT NULL
      THEN now()
      ELSE NULL
    END,
    left(new.raw_user_meta_data->>'utm_source', 120),
    left(new.raw_user_meta_data->>'utm_medium', 120),
    left(new.raw_user_meta_data->>'utm_campaign', 120),
    left(new.raw_user_meta_data->>'utm_content', 120),
    left(new.raw_user_meta_data->>'utm_term', 120),
    left(new.raw_user_meta_data->>'landing_page', 200)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$function$;

-- Billing-protection trigger (052), plus the attribution columns: settable
-- on the browser's own INSERT (the dashboard auto-create), frozen on UPDATE.
CREATE OR REPLACE FUNCTION public.protect_profile_billing_columns()
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
  -- First-touch attribution is history, not a setting.
  NEW.utm_source := OLD.utm_source;
  NEW.utm_medium := OLD.utm_medium;
  NEW.utm_campaign := OLD.utm_campaign;
  NEW.utm_content := OLD.utm_content;
  NEW.utm_term := OLD.utm_term;
  NEW.landing_page := OLD.landing_page;
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

DROP TRIGGER IF EXISTS protect_profile_billing_columns ON public.profiles;
CREATE TRIGGER protect_profile_billing_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_billing_columns();

-- ── 2. Meta conversion ledger, keyed by (user, event) ───────────────────────
-- Service-role access only: RLS enabled with no policies, so the anon and
-- authenticated keys can't read or write ad-attribution state.
CREATE TABLE IF NOT EXISTS public.meta_conversion_events (
  user_id uuid NOT NULL,
  event_name text NOT NULL,
  event_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_name)
);
ALTER TABLE public.meta_conversion_events ENABLE ROW LEVEL SECURITY;

INSERT INTO public.meta_conversion_events (user_id, event_name, event_id, created_at)
SELECT user_id, 'CompleteRegistration', event_id, created_at
FROM public.meta_registration_events
ON CONFLICT (user_id, event_name) DO NOTHING;
