-- Per-user settings shown on Settings > Profile and Settings > Notifications.
-- Users already update their own profile row (policy "Users can update own profile"),
-- so no new policy or grant is needed.

alter table public.profiles
	add column email_signature text not null default '',
	add column notification_prefs jsonb not null default '{}'::jsonb;

comment on column public.profiles.email_signature is 'Appended to quote, invoice and follow-up emails this user sends.';
comment on column public.profiles.notification_prefs is 'Per-event in-app / email choices and the daily-summary flag. Shape: see lib/notificationPrefs.ts.';
