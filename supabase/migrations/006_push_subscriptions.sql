CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subscription JSONB     NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own subscription" ON public.push_subscriptions;
CREATE POLICY "Own subscription"
  ON public.push_subscriptions FOR ALL
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Tutor reads subscriptions" ON public.push_subscriptions;
CREATE POLICY "Tutor reads subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (public.get_my_role() = 'tutor');
