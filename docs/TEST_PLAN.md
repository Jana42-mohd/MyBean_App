# Manual test plan (run after the migrations)

Use two phones/emulators or a phone + the web build, with two email addresses (A = mum, B = partner).

## Signup / login / reset
- [ ] A signs up -> lands on the survey. Name, pronouns, relationship, caregiver, and **two babies** (use "Add another baby"; birth date copies over).
- [ ] Finish -> Home says "Hi <A's name>!" and "Today with <Baby1> & <Baby2>".
- [ ] Log out, log in again -> goes straight to Home (not the survey).
- [ ] Wrong password -> readable error. Airplane mode -> "Can't reach the server" + offline banner.
- [ ] "Forgot password?" with A's email -> email arrives -> link opens the app on **Choose a new password** -> new password works.
- [ ] Settings -> Change password works.

## Expecting parents
- [ ] In the survey choose "still expecting" for a baby: only name (optional) and due date are asked. Typing `20260314` shows `2026-03-14`.
- [ ] Home shows "<n> days to go" and the week of pregnancy; Track says baby isn't here yet and blocks logging.
- [ ] Later: Settings -> Babies -> Edit -> "already born", enter birth date etc. Logging now works.

## Babies & logs
- [ ] Track: pick one baby, log a feeding. Switch to "All babies (log together)", log a diaper -> History shows one entry per baby.
- [ ] History: baby filter works; entries show "<baby> · <parent> · date"; Edit note and Delete work.
- [ ] Pumping appears for every baby filter (it belongs to the parent).
- [ ] Settings -> Babies: remove a baby -> confirm warning -> their logs disappear.

## Two parents
- [ ] A: Settings -> Household -> Share the invite code.
- [ ] B signs up, completes the survey, then enters A's code -> B sees A's babies and logs; names show who logged what.
- [ ] Both see the same Home totals. Leave household works.

## Wellbeing (private)
- [ ] A saves a check-in and takes the EPDS. B (partner) cannot see any of it.
- [ ] Answering the last EPDS question with anything but "Never" shows the 9-8-8 / 911 card.

## Community
- [ ] Post, like, save. Delete own post works; other people's posts show Report.
- [ ] Three different accounts report one post -> it disappears from the feed.
- [ ] Moderator account: Settings -> Moderation shows it; Keep restores it, Delete removes it.

## Quick logging, timers & editing
- [ ] Home -> Feeding -> tap Breast: toast "Logged feeding for <baby>" appears; Undo removes it. Diaper works the same.
- [ ] With twins: pick "All babies" in the sheet -> one entry per baby appears in History.
- [ ] Sleep card starts a timer (banner counts up). Close and reopen the app: it is still running. "Woke up" saves a nap; under one minute is discarded.
- [ ] History -> Edit on each type (diaper, feeding, nap, pumping, mood, milestone): change the time/amount, save, the entry updates.

## Insights
- [ ] Home -> Insights & trends: charts for sleep, feedings, diapers; tap a bar to see its value; "Table" shows the same numbers; 7/30 day switch.
- [ ] A sleep that crosses midnight (e.g. 10pm-6am) is split across both days.
- [ ] "Share summary" opens the share sheet with a plain-text summary.

## Reminders (local, this phone only)
- [ ] Settings -> Reminders -> turn on "Next feeding": the phone asks permission. Set 1 h (or log a feeding with "next in" hours) and confirm the notification arrives.
- [ ] Logging a new feeding replaces the earlier pending reminder. Turning the switch off cancels it.
- [ ] Weekly check-in on: tapping the notification opens Wellbeing.

## Launch-readiness checks
- [ ] Settings -> Download my data: the share sheet offers a .json file; it contains your profile, babies, logs, wellbeing entries and posts.
- [ ] Settings -> Delete my account: type DELETE -> signed out, the same email can no longer log in and the profile row is gone.
  - Two parents: delete parent A. Parent B still sees the babies and the logs A entered; A's wellbeing, posts and pumping logs are gone.
  - Last parent: household, babies and logs are gone.
- [ ] Privacy policy and Terms open from Settings and from the signup screen (while signed out). No `[[...]]` placeholders show.
- [ ] Community: Report -> Block <member>: their posts disappear; Settings -> Blocked members -> Unblock brings them back.
- [ ] Moderator: Moderation -> Suspend author: they cannot post and their posts vanish; Restore reverses it.
- [ ] Log out, then log in as a different person on the same phone: no reminders or sleep timer from the first person remain.
- [ ] `cd frontend && npm run check:launch` passes.
