CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('estimate_request', 'message', 'system', 'review')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,                  -- optional internal link e.g. "/estimates/abc123"
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only read their own notifications
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

-- Users can update own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

-- Only server/admin can insert notifications (via service role key)
-- No INSERT policy for regular users — notifications are created server-side

CREATE INDEX notifications_user_id_read_idx
ON public.notifications(user_id, is_read) WHERE is_read = false;
