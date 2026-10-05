# Release guide: from this repo to the App Store and Google Play

Do the steps in order. `cd frontend && npm run check:launch` lists what is still missing.

## 0. Accounts you need (only you can create these)
| What | Cost | Needed for |
|---|---|---|
| Expo account (expo.dev) | free | cloud builds |
| Apple Developer Program | US$99 / year | iPhone app and TestFlight |
| Google Play Console | US$25 once | Android app |
| A place to host two web pages (website, GitHub Pages, Notion) | free | Privacy Policy URL + account-deletion URL |
| A support email address | free | stores and users contact you |

## 1. Fill in the facts the app and legal text need
1. Open `frontend/lib/appInfo.ts` and replace every `[[PLACEHOLDER]]` (legal name, support email, data region, email provider, backup days, governing law, policy date).
2. Pick your **app ID** and put it in `frontend/app.json` (`ios.bundleIdentifier` and `android.package`), for example `com.yourname.mylittlebean`. **It cannot be changed after the first store release.**
3. `cd frontend && npm run legal:export` writes `docs/legal/PRIVACY_POLICY.md` and `TERMS_OF_SERVICE.md`. Have a lawyer read them, then publish them on the web. The stores need the Privacy Policy as a public URL.
4. Also publish a short "Delete your account" page (Google Play requires a web link). Text to use:
   > To delete your My Little Bean account and its data: open the app, go to Settings, tap "Delete my account" and confirm. If you cannot access the app, email SUPPORT_EMAIL from the address on your account and we will delete it within 30 days. Deleting removes your profile, survey answers, wellbeing check-ins, pumping logs, community posts and photo. If a partner remains in your household they keep the shared baby records.

## 2. Supabase (production readiness)
- Run migrations `0001` to `0008` in order (see `SUPABASE_SETUP.md`).
- **Custom email (SMTP)** and **Confirm email ON** (`SUPABASE_SETUP.md` section 2). The built-in sender is rate-limited and not for real users.
- **Authentication -> URL Configuration -> Redirect URLs**: add `mylittlebean://**` (needed for password-reset links in the real app).
- **Rotate the old AWS RDS password** (it is in git history) and shut the instance down if it is no longer used.
- **Plan:** free Supabase projects are paused after a period of inactivity and have limited backups. Before launch, look at the paid plan so the project does not pause and you get daily backups. Whatever you choose, put the real backup retention in `BACKUP_DAYS`.
- Make yourself a moderator (`SUPABASE_SETUP.md` section 4) and keep an eye on reports: Apple and Google expect user reports to be acted on promptly.

## 3. Build with EAS
```bash
cd frontend
npm install -g eas-cli        # or use: npx eas-cli <command>
eas login
eas init                      # creates the Expo project and writes extra.eas.projectId into app.json
```
Cloud builds do not see your local `.env`, so give them the two public Supabase values (they are embedded in the app anyway):
```bash
eas env:set production --name EXPO_PUBLIC_SUPABASE_URL --value https://YOUR-PROJECT.supabase.co --visibility plaintext
eas env:set production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value YOUR-PUBLISHABLE-KEY --visibility plaintext
eas env:set preview    --name EXPO_PUBLIC_SUPABASE_URL --value https://YOUR-PROJECT.supabase.co --visibility plaintext
eas env:set preview    --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value YOUR-PUBLISHABLE-KEY --visibility plaintext
```
Never put the Supabase `service_role` key anywhere in the app or in EAS.

**Test builds first**
```bash
eas build --profile preview --platform android    # installable .apk, share the link with testers
eas build --profile preview --platform ios        # needs devices registered: eas device:create
```
Walk through `TEST_PLAN.md` on the real builds: notifications, password-reset links and photo upload behave differently from Expo Go.

**Store builds**
```bash
eas build --profile production --platform all
eas submit --platform ios       # uploads to App Store Connect / TestFlight
eas submit --platform android   # uploads to Google Play (first upload to a new app may need to be done by hand in the console)
```

## 4. Store listings
Use `STORE_LISTING.md` (descriptions, privacy answers, review notes). You also need screenshots (take them from the preview build) and the privacy-policy and account-deletion URLs.

- **Reviewer access:** both stores need a working login. Create a demo account whose email is confirmed (create it in the Supabase dashboard with "Auto Confirm User"), add a baby and some logs, and put the credentials in the review notes. If Confirm email is on, a reviewer cannot sign up on their own.
- **Google Play new-developer rule:** new personal developer accounts have had to run a closed test with a minimum number of testers for about two weeks before production access. Check the current rule in the Play Console and start that clock early.
- **Apple UGC requirements (guideline 1.2)** for apps with a community: report a post, block a member, moderation with timely action, and published contact details. All are built in; keep the support email monitored.
- **Health apps (guideline 1.4.1):** the wellbeing section is a screening and support tool and says it is not a diagnosis. Keep that wording in the store description.

## 5. After launch
- Check Supabase logs and the moderation screen regularly.
- Bump `version` in `app.json` for each release. EAS increments the build numbers for you (`autoIncrement`).
