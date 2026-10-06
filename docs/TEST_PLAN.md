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
13. `0013_groups.sql`: small group chats (up to 8, only between connected parents)
14. `0014_post_media.sql`: photos and videos in community posts (private `post-media` bucket)
15. `0015_unread_and_places.sql`: unread counts for chats and groups, and cities chosen from a list
16. `0016_save_place.sql`: fixes saving the place in Settings (run it!)
17. `0017_app_name.sql`: push notification title says "My Bean"
18. `0018_comments.sql`: comments and replies under posts

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

### Group chats (0013)
Up to 8 people (members plus pending invitations); each person may start 5. You can only invite parents you are connected
with, and each invitee must accept. If the creator leaves, the longest-standing member takes over; a group with one person
left is deleted. Blocking someone removes you from every group you share with them. Reports of a group message go to the
same moderator list as other reports (a copy of only that message). Notifications say who wrote and in which group, never
the text, and each group can be muted.

### Photos and videos in community posts (0014)
Up to 4 files per post, at most one video (30 seconds, 25 MB in the app; the bucket allows 50 MB). Photos are resized to
1600 px and re-encoded, which removes location data. Files are in a private bucket and shown through links that expire
after an hour; they stop being readable by others when a post is hidden (3 reports) or deleted. Deleting a post (or an
account) also deletes its files from storage; moderators can delete a post's files too.
Supabase's free plan caps uploads at 50 MB per file (Storage -> Settings), which is also this bucket's limit. Plan storage
and bandwidth costs: videos are the expensive part, so keep an eye on Storage usage after launch.
Nothing scans uploads automatically: moderation relies on reports (and the 3-report auto-hide). Before launch, decide who
reviews reports and how fast, since photos and videos make that more important.

### Unread counts and the city list (0015)
Each person has a "read up to" time per chat and group (`chat_reads`, reachable only through functions). The Community
tab shows one number: unread messages + connection requests + group invitations. It refreshes every 30 seconds while the
app is open, when a notification arrives and whenever a chat is read. Existing chats count as read when you run the
migration. Muted groups still count in the number (the group's own pill is dimmed).
Cities come from a list built from GeoNames (CC BY 4.0; credited at the bottom of the city picker):
`frontend/assets/data/cities.json` (about 600 KB, 34,000 towns of 5,000+ people with their state or province). To rebuild
it, see `tools/generate-cities.py`. A town that is not in the list can be typed. Matching ignores capitals, accents and
punctuation; a city picked from the list must also be in the same region (Springfield, Illinois is not Springfield,
Missouri), while a hand-typed city (no region) matches any region.

### Comments (0018)
Threaded comments under posts (replies up to 6 levels), likes on comments, delete (a comment with replies stays as
"[deleted]"), report (three different people hide a comment until a moderator reviews it, under Settings -> Moderation ->
Reported comments). Hidden, suspended and blocked people's comments are not shown. People get a notification when someone
comments on their post or replies to their comment (it says who, never what; the "Requests, messages and replies" switch
in Settings controls it). 30 comments per hour per person. Deleting an account erases its comments, except where others
replied: those stay as "[deleted]" so the thread keeps its shape.

## 2. Email: do this BEFORE real users sign up
The built-in Supabase email sender is for testing only (a few emails per hour). It is the cause of
"email rate limit exceeded". Use your own provider:

1. Create a free account at **Resend** (or Brevo / Postmark / SES) and verify a sending domain.
2. Supabase -> **Authentication -> Emails -> SMTP Settings** -> enable **Custom SMTP** and enter host,
   port, username, password and sender (e.g. `hello@yourdomain.com`).
3. Authentication -> **Rate Limits**: raise "Emails sent per hour" to something sensible.
4. Authentication -> **Sign In / Providers -> Email**: turn **Confirm email** ON for production
   (OFF is fine while developing).
5. Edit the templates under **Authentication -> Emails** so they say "My Bean".

## 3. Redirect URLs (needed for password reset links)
Authentication -> **URL Configuration -> Redirect URLs**: add
- `mybean://**` (built apps)
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

## Topics and comments
- [ ] New Post offers Questions, Advice, Stories, Sleep, Feeding, Breastfeeding, Milestones, Health, Development, Mental Health, Pregnancy, Recommendations and Other. In the feed, the "All topics" drop-down (under All Posts / Liked / Saved) opens a list; choosing a topic shows only those posts (the drop-down turns yellow), and choosing "All topics" shows everything.
- [ ] Each post shows "Comments (n)". Tapping the title or that button opens the post with its comments.
- [ ] Add a comment: it appears at once and the count goes up. Reply to a comment: the reply sits indented under it (up to 4 levels of indent; a 7th level is refused).
- [ ] Like a comment (heart, count); like it again to undo. Sort by Top / Newest / Oldest. Tap a comment's name line to collapse its replies ("3 hidden").
- [ ] Delete your own comment: if nobody replied it disappears; if people replied it becomes "[deleted]" and the replies stay.
- [ ] Report someone else's comment from its ... menu. After 3 different people report it, it vanishes for everyone else; you still see your own marked "Hidden after reports". A moderator sees it under Moderation -> Reported comments and can keep or delete it, or suspend the author.
- [ ] A comment from someone you blocked is hidden for you only. A suspended person's comments disappear.
- [ ] The post author gets a notification "<name> commented on your post"; the person you replied to gets "<name> replied to your comment". Tapping it opens the post. Neither says what was written. Your own comments never notify you.
- [ ] Delete account: your comments are gone (or "[deleted]" where others replied).

## Faster logging (Quick Log on Home)
- [ ] Quick Log -> Feeding / Diaper: a "When was it?" row (Now, 10 min, 20 min, 30 min, 1 h, 2 h ago). Choosing "20 min ago" logs the entry 20 minutes back (check in History).
- [ ] Quick Log -> Feeding with one baby picked shows **Same as last time: breast · 4 oz**, which logs it at once. The amount box says what the last amount was; the last method is underlined.
- [ ] A new baby with no entries shows no "Same as last time" button. Home has no "Right now" card.

## Wellbeing: local help and weekly trend
Needs a real phone and a real account. Use a test account; the app only reads your own entries.
- [ ] Settings > Parents near you: set the country to Canada. Wellbeing > Support, any time says "Showing help for Canada" and lists 9-8-8 and Postpartum Support International, then Emergency 911. Tapping a line opens the phone's dialler with that number (do not press call).
- [ ] Change the place country to United Kingdom (or Ireland, Australia, New Zealand, United States): the list changes to that country's lines and emergency number, and 9-8-8 is not shown for the UK.
- [ ] A country with no list (for example Japan): a plain message, the findahelpline.com link, and "call your local emergency number". Germany or France shows 112.
- [ ] "Not your country? Change it" picks a country for this phone only. It wins over the place setting; "Go back to the country in my place settings" removes it. Check in Supabase (neighbor_profiles) that nothing changed there.
- [ ] No country at all (new account, no place): the Canada & US lines are shown, labelled as such, with "Choose your country".
- [ ] Take the screening answering "Sometimes" or worse to question 10: the "You deserve support right now" card shows the lines for the same country.
- [ ] Your weeks: after check-ins on different days, the chart shows an average per week (8 weeks, oldest on the left; a week with no check-ins is a short grey bar). Screening scores are listed under it.
- [ ] A gentle card appears only when the last two weeks each have at least 2 check-ins and each averages 2.5 or lower (or the last two screenings in 10 weeks both scored 10+). One bad week does nothing.
- [ ] Nothing on this screen is visible to your partner: sign in as the partner and check Wellbeing shows only their own entries.
- [ ] Delete account: the phone-only country choice is cleared too.
Numbers were checked against official pages in October 2026 (see lib/helplines.ts). Re-check them before each store release.
