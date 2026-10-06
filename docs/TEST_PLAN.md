# Manual test plan (run after the migrations)

Use two phones/emulators or a phone + the web build, with two email addresses (A = mum, B = partner).

## Navigation guard
- [ ] Welcome, Login and Signup screens show no tab bar. Signed-in screens show all five tabs, with "Community" readable in full.
- [ ] Signed in: reopen the app (swipe it away and open again) -> straight to Home, no welcome/login flash.
- [ ] Signed in: you cannot get back to Login or Signup (try the Android back button / iOS swipe back from Home): it stays on Home, or the survey if it is unfinished.
- [ ] Signed out: the app never shows Home, Settings, etc.; after Log out you are on the welcome screen and cannot go "back" into the app.
- [ ] Finish the survey -> Home appears WITH the tab bar and no "back" header.

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

## Live sync (needs two phones, or a phone + the web build, signed in as the two linked parents)
- [ ] Both Home screens show "● Live: updates from your partner appear instantly" under the greeting.
- [ ] A logs a feeding (Home -> Feeding -> Breast): B's Home toast says "<A> logged a feeding for <baby>" and B's Today totals go up within a second or two, without touching anything.
- [ ] B has History open: A's new entry appears there on its own. Edit and delete by A also show up on B.
- [ ] A starts the sleep timer: B's Home shows the "<baby> is sleeping (started by A)" banner counting up. B taps **Woke up**: exactly one nap is logged (not two) and A's banner disappears.
- [ ] A and B both tap **Woke up** at the same moment: still exactly one nap in History.
- [ ] Put B's phone in airplane mode, A logs two entries, turn airplane mode off: B catches up within a few seconds (or by reopening the app).
- [ ] Background B's app for a minute, A logs something, bring B back: B shows it.
- [ ] A leaves the household: B stops getting A's updates. A rejoins with the code: updates flow again.
- [ ] A third account (not in the household) never sees these entries or notices.

## Growth tracker and milestones
- [ ] Home -> Growth Tracking opens the Growth screen (not the Info page); Home -> Milestones opens the Milestones screen.
- [ ] Growth: add a measurement (weight, length, head: any of them). The chart shows grey WHO percentile lines and your baby's dots; tapping a dot shows value, age and percentile.
- [ ] kg/cm <-> lb/in toggle changes the inputs, axis and list; values stay consistent. Typing 65 kg for a newborn is rejected with a clear message.
- [ ] A baby with gender "prefer not to say" shows the measurements without percentile lines and says why. A premature baby shows the corrected-age note.
- [ ] Edit and delete a measurement. History shows growth entries (filter "Growth").
- [ ] Milestones: tap a suggestion, add with a date, see "<n> months old" next to it. With twins, "All babies" adds one per baby.

## Working offline (use airplane mode)
- [ ] Airplane mode on. A yellow/pink banner says you're offline. Home -> Feeding -> Breast: the toast says "(saved offline, will sync)", Today's feedings goes up, and History shows the entry with "Saved on this phone, waiting to sync".
- [ ] Log a diaper and a growth measurement offline too. Turn airplane mode off: within a few seconds the banner says "Syncing" and disappears; the entries now show Edit/Delete; your partner's phone receives them.
- [ ] Undo on an offline entry removes it (nothing is ever sent). Undo after it synced deletes it on the server.
- [ ] Offline: tap Sleep (timer starts, "saved offline"), then Woke up. Go online: exactly one nap appears with the right start/end times.
- [ ] Offline: log 3 entries, force-close the app, reopen still offline: the 3 entries are still there. Go online: they sync once (no duplicates).
- [ ] Offline: History/Track/Home still show what you saw last time, not an error screen.
- [ ] Log out with unsent entries: you get a warning. Log in as someone else on the same phone while online: the first person's entries are NOT sent under the second account. Log back in as the first person: they sync.
- [ ] Flaky connection (enable airplane mode midway through logging): no entry is lost and none is doubled.
- [ ] Offline edit: go offline, History -> Edit a synced feeding (change the amount) and Save: it shows the new value with "waiting to sync". Delete another synced entry: it disappears from the list. Go online: both reach the server and your partner's phone shows the change/removal.
- [ ] Offline: edit an entry you just logged offline (still unsent): it stays one entry. Delete one: nothing is ever sent.
- [ ] Edit the same entry on both phones at once (one offline): the later change to reach the server wins, nothing crashes.
- [ ] Your partner deletes an entry that you edited offline: syncing does not show an error.

## Partner notifications (two phones; a development build on Android, Expo Go works on iPhone)
- [ ] Settings -> Partner notifications is on. After linking a partner, the phone asks to allow notifications.
- [ ] Phone A logs a feeding while B's app is closed: B gets "<A> logged a feeding for <baby>". Tapping it opens Home.
- [ ] Logging for twins ("all babies") sends ONE notification naming both. A diaper right after sends a second one.
- [ ] B has the app open: no banner on top of the app (Home shows the in-app notice instead).
- [ ] B turns the switch off: A's next entry sends nothing. Turn it on again: it works again.
- [ ] A's own phone never gets a notification for A's entries. Pumping, wellbeing check-ins and entries made offline more than 2 hours ago never notify.
- [ ] B logs out: B's phone stops receiving A's entries' notifications. Another person logging in on that phone does not get B's.
- [ ] Notifications denied in the phone's settings: turning the switch on explains how to allow them.

## Milestone photos
- [ ] Milestones -> Add: choose a photo from the library, and take one with the camera; save. The photo shows on the card and on the partner's phone.
- [ ] A milestone for twins ("All babies") with a photo shows the photo on both babies' cards. Deleting one baby's milestone keeps the photo on the other.
- [ ] Edit a milestone: replace the photo, remove it. The old file disappears (Supabase -> Storage -> milestone-photos).
- [ ] Offline: adding/changing a photo says it needs a connection; the milestone itself can still be saved without it.
- [ ] A photo taken with location on: after saving, the stored file has no GPS data (check with any EXIF viewer).
- [ ] A photo link copied from one account does not open for a different household (private bucket; links also expire after an hour).
- [ ] Deleting an account as the only household member removes the photos from Storage.

## Parents near you (three phones/accounts: A and B in the same neighbourhood, C in the same city, D in another country)
- [ ] Settings -> Parents near you: pick a country, type a city and neighbourhood, Save. The switch is OFF until you turn it on, and turning it on shows a confirmation that says exactly what others will see.
- [ ] Before anyone turns the switch on, "Find parents near me" says you are hidden and sends you to Settings. A hidden person sees nobody (you only see others once you are visible).
- [ ] A and B both visible: each sees the other under the neighbourhood tab; C sees A and B under the city tab but not under the neighbourhood tab (if C's neighbourhood differs); D sees them only if D is in the same country.
- [ ] "The Annex" and "the  annex." (capitals, extra space, full stop) count as the same neighbourhood.
- [ ] A partner in the same household never appears in your list.
- [ ] A taps Connect, writes an intro, sends. B gets a push ("A parent near you would like to connect"; the intro text is NOT in it) and a badge on the Community tab. Tapping the push opens Connections.
- [ ] B accepts: A gets a push, and both can open the chat. A message sent by one shows on the other within about 5 seconds, and a push says "<name> sent you a message" without the text.
- [ ] Before B accepts, there is no chat. If B declines, A can no longer find B and cannot ask again; B no longer sees the request.
- [ ] Long-press your own message to delete it; long-press theirs to report it.
- [ ] Report someone from the chat menu: it confirms. In a moderator account, Settings -> Moderation -> Reported parents shows the reason and ONLY the reported message. After 3 different people report someone they disappear from every list; "Clear reports" brings them back.
- [ ] Block someone from the chat menu: the chat disappears for both, neither sees the other in lists, and a new request is refused.
- [ ] Switch visibility off: you disappear from the lists immediately; existing connections keep working. Turn off "Notify me about requests and messages": no pushes.
- [ ] Download my data includes your place, connections and messages. Delete account: your connections and messages are gone for the other person too.

## Group chats (four accounts: A connected to B, C and D)
- [ ] Connections -> + New group: name it, pick B and C, create. B and C get a push ("A invited you to a group") and a Group invitations card with Join/Decline.
- [ ] Before they join, B and C cannot read the group. After joining, everyone sees messages with the sender's name on other people's bubbles; a message appears on the others' phones within ~5 seconds with a push that says who wrote and where, not what.
- [ ] You cannot pick someone you are not connected with. A group needs a name and at least one invitee. The 9th person is refused.
- [ ] Group menu -> Members and invitations: the creator can remove people and cancel invitations; others cannot. Anyone can invite one of their own connections (it is refused if someone in the group has blocked them).
- [ ] Mute: no pushes for that group, messages still arrive. Long-press someone's message -> Report; a moderator sees only that message. Long-press your own -> Delete.
- [ ] Block a member (from your one-to-one chat with them): you disappear from every group you share with them.
- [ ] The creator leaves: the longest-standing member becomes the creator. When only one person is left the group disappears. Delete group (creator only) removes it for everyone. Deleting the creator's account keeps the group for the rest.

## Settings screen
- [ ] The page uses the same dark-teal cards as the other tabs: titled sections, one rounded card per group of settings, pink headings, no leftover grey-blue buttons or red Log Out button.
- [ ] Tap the avatar (camera badge): Choose from library / Take a photo. The spinner shows while it uploads.
- [ ] Babies: tap a baby to edit, Remove asks for confirmation. Household: invite code row shares, join code works, Leave household appears only with a partner.
- [ ] Notifications and Reminders: switches, the hour steppers appear only when the reminder is on. Change password expands in place. Delete my account is at the very bottom and needs typing DELETE.
- [ ] Everything is readable at the largest phone font size and in landscape.

## Photos and videos in posts
- [ ] Community -> Start a new post: "Photos or video" opens the library (several photos at once), "Camera" takes a photo or records a video. Chosen files show as thumbnails with an X to remove them.
- [ ] A 4th photo is allowed, a 5th is refused; a second video is refused; a video longer than 30 seconds, or over 25 MB, is refused with a clear message.
- [ ] Publish: the button shows "Uploading 1 of 3..." then publishes. The post shows the photos in a grid (an odd last photo fills the row) and the video with play controls. Tap a photo to see it full screen.
- [ ] Another account sees the media. A third account that blocked the author does not see the post at all.
- [ ] Turn on airplane mode, publish with a photo: it fails with a clear message, nothing is posted and no stray file is left in Storage -> post-media.
- [ ] Delete your own post: its files disappear from Storage -> post-media.
- [ ] Report a post with photos 3 times from 3 accounts: it disappears for everyone but the author and moderators; a moderator sees its photos/video on the Moderation screen and can delete it (files removed too).
- [ ] A photo taken with location on: the uploaded file has no GPS data (check with an EXIF viewer).
- [ ] Delete account: your post files are removed from Storage.
