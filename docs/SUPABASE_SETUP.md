# Supabase setup

Project URL: `https://rkfqrxwqbzntexonutib.supabase.co`. The app reads `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_ANON_KEY` from `frontend/.env` (copy `frontend/.env.example`). Never commit `.env`.

## 1. Database (in order, once each)
Supabase dashboard -> **SQL Editor**, run these files from `supabase/migrations/` in order:

1. `0001_init.sql`: users, logs, community, avatar storage
2. `0002_households_wellbeing.sql`: linked parents (households) + private wellbeing
3. `0003_babies.sql`: multiple babies (twins/triplets); existing data is carried over
4. `0004_moderation.sql`: delete-own-post, reporting, auto-hide, moderators
5. `0005_expecting.sql`: expecting parents (due date, switch to "born" later)
6. `0006_delete_account.sql`: in-app account deletion (store requirement)
7. `0007_blocks_suspension.sql`: block members + moderator suspension (store requirement for community apps)
8. `0008_live_sync.sql`: live sync between partners + shared sleep timers (turns on Realtime for the needed tables)
9. `0009_growth.sql`: growth measurements (weight, length, head size) as a new log type
10. `0010_security_hardening.sql`: invite-code throttle, size limits, post rate limit, tighter profile visibility
11. `0011_push_and_photos.sql`: partner notifications (push tokens + a database trigger) and the private `milestone-photos` bucket
12. `0012_neighbors.sql`: parents near you (private location table, connection requests, chat, reports, notifications)

Live sync needs Supabase **Realtime** to be enabled for the project (it is by default). After running 0008 you can check
**Database -> Publications -> supabase_realtime**: `logs`, `babies`, `profiles` and `active_sleeps` should be listed.

### Partner notifications (0011)
The database sends the notification itself through Expo's push service using the **pg_net** extension, so no server of
your own is needed. 0011 tries to enable it; if you see the notice "pg_net is not available", turn it on under
**Database -> Extensions -> pg_net** and run `create extension if not exists pg_net;`.
Push tokens need an Expo project id: run `npx eas init` once in `frontend/` (it writes it into `app.json`). Remote push
does **not** work in Expo Go on Android (iPhone Expo Go works); use a development build for Android testing.
For release builds, iOS needs an APNs key and Android needs FCM credentials added in EAS (`eas credentials`).
Notifications are sent to the other people in the household only, never contain wellbeing data, and are skipped for
entries older than 2 hours (offline entries synced late).

### Milestone photos (0011)
Photos live in a **private** bucket (`milestone-photos`, 5 MB, jpeg/png/webp). Only members of the household named in the
file path can see them; the app shows them through links that expire after an hour. The app shrinks each photo to
1600 px and re-encodes it, which also removes location data. Photos are deleted when their milestone is deleted, and
when the last member of a household deletes their account.

### Parents near you (0012)
Opt-in only. Parents type a country, city and neighbourhood (no GPS) and must switch "Let nearby parents find me" on
themselves; until then nobody can see them. Others see only name, photo, city and neighbourhood. A request must be
accepted before anyone can message. Blocking deletes the connection and its chat. Three different people reporting
someone hides them from the lists until a moderator reviews them (Settings -> Moderation -> Reported parents, where you can
clear the reports or suspend). Moderators cannot read chats: a report carries a copy of only the reported message.
Chats refresh every 5 seconds while open (there is no live channel); requests and new messages send a push
notification that says who wrote, never what. The people of a household never appear in each other's lists.
Matching is on the text typed, ignoring capitals, punctuation and extra spaces ("The Annex" = "the  annex."), but not
spelling or accents. If you want people to pick from a list of cities instead, that is a next step.
Before launch: the Terms ask users to be 18+, and App Store / Google Play review will look at the report/block tools and
moderation process for this feature. Make sure someone is assigned to review reports (see `docs/RELEASE.md`).

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

## 3. Redirect URLs (needed for password reset links)
Authentication -> **URL Configuration -> Redirect URLs**: add
- `mylittlebean://**` (built apps)
- `exp://**` (Expo Go while developing)
- your Expo tunnel/LAN URL if Supabase rejects the `exp://` wildcard

## 4. Moderators
Run in the SQL editor with your own email:
```sql
update public.profiles set is_moderator = true
where id = (select id from auth.users where email = 'you@example.com');
```
Moderators get **Settings -> Moderation -> Review reported posts**. Three different people reporting a post hides it
automatically until a moderator keeps or deletes it.

## 5. Make yourself a clean test account
Authentication -> Users -> delete the old test users, then sign up through the app (see `TEST_PLAN.md`).
