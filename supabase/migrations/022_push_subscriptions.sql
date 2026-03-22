CREATE TABLE push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subscription JSONB NOT NULL,
  user_agent TEXT,
  device_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX push_subs_user_device_uniq
  ON push_subscriptions (user_id, device_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY push_subs_own ON push_subscriptions
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY push_subs_service ON push_subscriptions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
