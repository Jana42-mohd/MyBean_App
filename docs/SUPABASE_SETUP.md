# Supabase setup

Project URL: `https://rkfqrxwqbzntexonutib.supabase.co`. The app reads `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_ANON_KEY` from `frontend/.env` (copy `frontend/.env.example`). Never commit `.env`.

## 1. Database (in order, once each)
Supabase dashboard -> **SQL Editor**, run these files from `supabase/migrations/` in order:

1. `0001_init.sql`: users, logs, community, avatar storage
2. `0002_households_wellbeing.sql`: linked parents (households) + private wellbeing
3. `0003_babies.sql`: multiple babies (twins/triplets); existing data is carried over
4. `0004_moderation.sql`: delete-own-post, reporting, auto-hide, moderators

## 2. Email: do this BEFORE real users sign up
The built-in Supabase email sender is for testing only (a few emails per hour). It is the cause of
"email rate limit exceeded". Use your own provider:

1. Create a free account at **Resend** (or Brevo / Postmark / SES) and verify a sending domain.
2. Supabase -> **Authentication -> Emails -> SMTP Settings** -> enable **Custom SMTP** and enter host,
   port, username, password and sender (e.g. `hello@yourdomain.com`).
3. Authentication -> **Rate Limits**: raise "Emails sent per hour" to something sensible.
4. Authentication -> **Sign In / Providers -> Email**: turn **Confirm email** ON for production
   (OFF is fine while developing).
5. Edit the templates under **Authentication -> Emails** so they say "My Little Bean".

## 3. Redirect URLs (needed for password reset and Google sign-in)
Authentication -> **URL Configuration -> Redirect URLs**: add
- `mylittlebean://**` (built apps)
- `exp://**` (Expo Go while developing)
- your Expo tunnel/LAN URL if Supabase rejects the `exp://` wildcard

## 4. Google sign-in (optional)
1. Google Cloud Console -> APIs & Services -> **Credentials** -> Create **OAuth client ID** (type *Web application*).
2. Authorized redirect URI: `https://rkfqrxwqbzntexonutib.supabase.co/auth/v1/callback`.
3. Supabase -> Authentication -> **Sign In / Providers -> Google**: enable it and paste the Client ID and Secret.
4. Until this is done the app shows "Google sign-in is not set up yet" when the button is tapped.

## 5. Moderators
Run in the SQL editor with your own email:
```sql
update public.profiles set is_moderator = true
where id = (select id from auth.users where email = 'you@example.com');
```
Moderators get **Settings -> Moderation -> Review reported posts**. Three different people reporting a post hides it
automatically until a moderator keeps or deletes it.

## 6. Make yourself a clean test account
Authentication -> Users -> delete the old test users, then sign up through the app (see `TEST_PLAN.md`).
