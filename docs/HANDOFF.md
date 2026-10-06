# My Bean: handoff for a new Claude session

Read this first. It is the state of the project at commit `a9301a9` plus the way the owner likes to work.

## What this is
**My Bean** (formerly "My Little Bean"): an Expo / React Native baby-tracking and parent-support app, backed by Supabase.
Repo `Jana42-mohd/MyBean_App`, work branch **`claude/pensive-curie-swxrmr`** (no pull request opened yet; all work is pushed to this branch).
The owner is not a developer: explain in plain language, give exact commands (they use **Windows PowerShell**), and say what you could not test.

## Layout
- `frontend/` Expo SDK 57, expo-router, React Native 0.86, TypeScript. `app/` screens, `components/`, `lib/` logic, `tests/` unit tests, `assets/data/cities.json` (GeoNames, CC BY 4.0).
- `supabase/migrations/0001..0018` (all SQL, run by hand in the Supabase SQL editor, in order), `supabase/tests/` (assertion-based SQL tests), `tools/` generators.
- `docs/` SUPABASE_SETUP, TEST_PLAN (manual checklists per feature), TESTING, RELEASE, STORE_LISTING, legal drafts.

## Checks to run before every push (all must pass)
```
cd frontend && npx tsc --noEmit && npm test && npx expo lint        # unit tests, 0 lint errors (10 old warnings)
EXPO_PUBLIC_SUPABASE_URL=https://x.supabase.co EXPO_PUBLIC_SUPABASE_ANON_KEY=x npx expo export --platform android --output-dir /tmp/android-out
# database (needs a local PostgreSQL: pg_ctlcluster 16 main start; it may need restarting between commands)
PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres bash supabase/tests/run.sh
```
Do not chain checks with `;` or `| grep` and then commit: a failing test once got pushed. Verify the output first.
CI (`.github/workflows/ci.yml`) runs the same on GitHub; the last result seen was green for the first two runs only.

## How we work (keep doing this)
- **Every database rule gets an SQL test, and a "mutation check"**: break the rule on purpose in a copy of the migration and confirm a named test fails, then restore.
- Real Supabase (Realtime, Auth, Storage, push) is NOT reachable from the sandbox. Everything was tested with a local Postgres and stand-in clients, so say plainly what is unverified on real phones.
- Visual checks: build the web export and drive it with Playwright (`/opt/node-tools/node_modules/playwright-core`, Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`) against a mocked `https://x.supabase.co` (fake auth session in localStorage, route fixtures for `/rest/v1/*` and rpc). That harness lives in the old scratchpad; rebuild it if needed.
- Colours come only from `frontend/lib/theme.ts` (`useTheme`, `useStyles(makeStyles)`); never write hex in screens. Light and dark have a contrast unit test.
- Commit messages end with the Co-Authored-By / Claude-Session lines from the system reminder. Never put a model name in code or commits.

## What exists (all built, pushed)
Auth (email/password, PKCE reset links, `mybean://`), survey, multiple babies (twins/expecting), households with partner linking and live sync (Realtime), shared sleep timers, quick log, History edit/delete, Insights charts, Growth tracker (WHO percentiles), Milestones with private photos, offline outbox (log, edit, delete, sleep), local reminders, partner push notifications (pg_net -> Expo), wellbeing + EPDS (private), community posts with photos/videos, topics drop-down filter, threaded comments with likes/reports, moderation screen, account deletion/data export, legal drafts, light/dark theme (Settings > Appearance), **Parents near you** (opt-in, typed place, city picker from a list), connection requests, 1:1 chat, small group chats (max 8), unread badge on the Community tab, Quick Log with a "When was it?" picker and "Same as last time". (A Home "Right now" card was built and then removed at the owner's request: it felt repetitive.)

## What the owner must still do (remind them)
1. Run migrations **0016** (fixes saving the place), **0017** (push title "My Bean"), **0018** (comments) in Supabase if not done yet; then `git pull` (if `frontend/lib/appInfo.ts` has their own details, they use `git stash`, `git pull`, `git stash pop` and keep their values; `git checkout -- package-lock.json` before pulls).
2. In Supabase add redirect URL `mybean://**`; custom SMTP + "Confirm email"; fill `lib/appInfo.ts`; choose the real app ID in `app.json`; `npx eas init`.
3. Test on real phones with 2-3 accounts using `docs/TEST_PLAN.md`; lawyer review of the legal text; store accounts; decide who reviews reports (stores will ask).
4. Known: they were logged out once after the rename (Expo Go keys storage by slug); "Invalid login credentials" means check Supabase Auth > Users.

## Known limits / ideas not built
Chats and comments refresh by polling (no live channel); no comment edit; comments are text only (the owner declined photos); sleep cannot be backdated; places under 5,000 people are typed by hand; nothing scans uploads (reports + 3-report auto-hide only).
Ideas the owner liked: doctor-visit PDF summary, patterns in Insights, local crisis helplines by country, "near me" filter for posts, first-run walkthrough, crash reporting without tracking, accessibility pass.

## Owner preferences
Dark teal theme with soft pastel pink and butter-yellow accents; light mode = pale aqua page, white cards, teal text, pastel fills only (they disliked deep pink and gold text). Pink should be used sparingly (main actions, selected states). They like compact controls (drop-downs over chip walls).
