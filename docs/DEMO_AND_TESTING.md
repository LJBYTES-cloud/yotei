# Demo, Testing, and Troubleshooting

## Start the Native App

```powershell
npm.cmd ci
npx.cmd expo start --clear
```

Use the compatible SDK 57 Expo Go client or an up-to-date development build. Standard shells can use npm/npx without .cmd. `npx start -c` is incorrect. Ran npx.cmd expo install expo-document-picker; it was already SDK-compatible. A custom client must include the native picker; the matching Expo Go client includes it.

## Presentation Walkthrough

1. Set USE_REAL_AUTH=false and fully reload to use student@yotei.demo / study12345 and Load Demo Data. Real Appwrite mode strictly hides the loader and also rejects the demo reset action. The adapter is not switched automatically.
2. Settings > Load Demo Data replaces only this account's local study records. The replacement warning remains visible. It keeps authentication and other accounts intact and returns to Home.
3. Home shows today's 240 planned minutes and a populated recent week. Demo history starts six calendar months ago, with hundreds of completed sessions, 20 subjects across five fields, 40 unique tasks and 40 material references. Counts vary with weekdays and month length. Historical work includes breaks, late starts, overruns, underruns and some rest days.
4. Tap the larger chart dots or their surrounding touch area: each opens its daily detail dialog, not the background summary. Scheduled / Actual / Overrun must reconcile: Actual includes breaks, duration Overrun is max(0, Actual - Scheduled). Late clock finishes are shown separately. The background still opens weekly total/average/best day and accessible date links. Y labels use whole hours (0, 1h, 2h, etc.); all-zero weeks retain a one-hour scale without invented study minutes.
5. Browse Library spines/covers in both themes, open a book, edit a subject and inspect its described tasks. Use the top-right task kebab for Edit/Delete; actions must not appear inline. Confirmed deletion, cancel, duplicate taps and missed-badge behavior remain unchanged.
6. In Study Materials, Browse File Manager is the primary form action. Pick a file; its title auto-fills when blank. Save, restart, and confirm the row retains a private documents URI after picker-cache cleanup. Edit/delete use the material kebab. Cancel a pick or close an unsaved draft without changing an existing material. New unsaved copies are cleaned up; provider originals and saved files are preserved.
7. Expand Use URL / File Path to add a website manually. Existing manual references stay editable. Opening a location requires an OS handler/permission; a failure shows a recoverable error. File bytes stay local and are not embedded in JSON backups.
8. Schedule with native dates and optional duration; >240 planned minutes still needs explicit Schedule Anyway. At the scheduled time, Start Session, Take Break, Resume Work and Finish Session. The live timer contains no lateness message. Finish opens the reflection sheet with saved-start feedback: Session complete! You started X minutes late, less than a minute late, or You started exactly on time! Completion persists before the reflection prompt; save a reflection or Skip without undoing done status.
9. Journal is a unified newest-first feed of Session Reflection and Journal Entry cards. Open New Entry, write Title and Content, and save. A failed save retains the draft; success refreshes the timeline and uses a toast. Manual entries require no subject and survive subject deletion. Demo entries span six calendar months. Scroll quickly through the expanded timeline and shelves, including back to the top; check both themes and unfolded-book animations.
10. Fresh/legacy appearance loads Light with the switch OFF, even if the phone is Dark or old storage contains bare dark. Toggle ON for Dark, restart, and confirm the new version-2 explicit choice persists. Toggle OFF for Light. Settings has no mode/general info icons except the restored JSON-backup help on Data Management; burnout guidance still opens its themed dialog. Test the cream startup while fonts/preferences load.
11. Check that each success slides above the tab bar and disappears after three seconds, including repeated identical messages. Switching to Settings discards it. Settings never displays backup/demo/reflection success notices, and returning does not replay them. Errors remain inline.
12. Toggle Light/Dark and cold restart: saved choice restores; a fresh/missing preference defaults Light. Tap info icons on screens and inside sheets: Merriweather/Inter themed dialogs scroll and dismiss with OK/close/backdrop/Android Back without changing drafts.
13. Export a backup through Settings and save the shared JSON. Add a temporary subject, then import: it disappears and all lists/chart refresh. Version 6 includes manual journal entries, descriptions, reflections/session links and material URIs; versions 1-5 still import. File contents stay on this device. Invalid/canceled imports preserve data. See DATA_BACKUP.md.

14. In Schedule Session, tap Switch to 12h: schedules, journal timestamps, completion logs and best-hour suggestions use AM/PM. Tap Switch to 24h for 00:00-23:59. Cold restart and verify the preference restores. Elapsed timers, totals and chart duration axes remain durations.
15. Settings > Edit Display Name: save a trimmed name, verify the profile updates immediately and the user ID/study records stay intact. Retry a simulated failure without losing the draft. Remembered Mock and Appwrite sessions restore the updated name; real Appwrite API success still needs a signed-in device check.
16. Mark a scheduled Home block as done without running the timer. Its scheduled duration appears in today's completed totals and optional reflection prompt. Check Start Session is the only main button; the top-right kebab contains Mark as Done and Delete Block. Start is disabled before its window. With another active or paused session, Start remains clickable and shows "You already have a session in progress. Finish it before starting a new one." without starting a second timer. Confirm break/resume still work. Choose Delete Block from the kebab, wait for the menu to dismiss, then use the themed Cancel/Delete Block dialog; its Task and other blocks remain in Library. Check both themes, backdrop/Android Back cancellation, duplicate taps, loading/error retry and larger text on a narrow phone.
17. Tap a manual or session-reflection Journal card. Read the complete note, edit/save, cancel or confirm deletion. Reflection edits change the note rather than the task title; dates, linked session and chart totals remain intact.

Reload demo data on a new date; existing seeded sessions do not move automatically.

## Acceptance Checks

| Flow | Check |
| --- | --- |
| Auth | Welcome Back heading, validation, password visibility, loading/errors, trimmed email, remembered/cold-boot session behavior, sign-out |
| Demo | Only Mock auth shows/can run the demo loader; repeat loading gives 20 unique subjects / 5 fields / 40 unique tasks / 40 materials and date-dependent hundreds of blocks plus unique reflections/journal entries across six calendar months; other accounts unchanged |
| Colors/theme | Identical vibrant gradients in both themes; light ink on dark book labels; new explicit version-2 preferences persist; legacy/missing/invalid preferences fall back Light; switch OFF=Light and ON=Dark |
| Descriptions | Create/edit through the task kebab and clear multiline descriptions; failure retains drafts; omitted service updates preserve descriptions |
| Materials | Primary file picker makes permanent private copies, secondary manual input still works; kebab CRUD, confirmation, cancel/retry and website/path errors; no upload or original-file deletion |
| Calendar | Today at 5 PM is valid at 4 PM; passed instants reject; future dates/midnight/DST preserve duration and per-day workload |
| Timer | One active per account; precise breaks, no active lateness warning, post-completion late/on-time feedback, background/cold restore, active sessions reachable beyond end/midnight |
| Coach | One note in order: overdue incomplete task, postponed >=2, planned workload >240, completed today+yesterday, optional best-hour suggestion. Done tasks are not overdue; local date-only deadlines include the whole due day |
| Lists | Rapidly scroll the six-month Journal and field shelves; items remain readable, refresh/actions work, and a revealed cover animates back without clipped or missing content |
| Journal | New Entry validates Title/Content, retains drafts on error, appears in one newest-first feed with reflections, uses global success toasts and is account-scoped |
| Reflection | Finish persists done first; note attaches correct subject/block; Skip/failure never reverts done; standalone notes allowed |
| Reflection migration | Upgrade with old topics: IDs/subjects/text preserved as notes; old schedule retired; failed migration rolls back and can retry |
| Deletion | Subject cascades dependent records; task deletes blocks but retains journal notes with null session links and material notes |
| Progress | Zero-filled week; done-only actual minutes; legacy untimed fallback; ownership; day details sum to chart total; allocated/break/elapsed/overrun match SQLite |
| Chart interaction | Point and background have separate actions; summary day rows are accessible; dialogs handle errors, empty days and both themes |
| Recommitment | Elapsed unstarted scheduled blocks become missed; replacement preserves history and increments postpone_count exactly once; coaching after 2 |
| Keyboard | Auth, note forms and every sheet keep the focused input visible; long text and OS text scaling remain usable |
| Toast | Single host above actual tab bar; 3 seconds per notice; no Settings display/replay; hidden notices still expire |
| Info dialogs | Correct theme/fonts, scrollable long text, all dismissal paths, nested sheet usage; destructive confirmations remain native |
| Backup | Version-6 manual-entry round-trip/legacy conversion, linked ID remapping, other-account isolation, cancellation, malformed data and rollback |
| Browser | Mobile-only notice; no SQLite/WASM loader; native features remain Android/iOS only |

For missed-block demos, schedule the next whole minute for one minute, wait for its end and the next detection tick (up to 30 seconds), then reschedule. Repeat to demonstrate postponement coaching. Automated tests exercise this without waiting.

## Coach Checks Without Waiting

The seeded overdue Mathematics task takes first priority, ahead of the two postponed examples. Use disposable fixtures to test the lower-priority rules without altering the device clock or real study records. Production-SQL tests cover local-calendar streaks, sufficient best-hour history, DST/fractional offsets, ownership and manual completions. Component tests verify one message and saved-format hour suggestions. The old 72-hour/last-overrun priority list is superseded.

## Automated Commands

```powershell
npx.cmd expo lint
npx.cmd tsc --noEmit
node --experimental-vm-modules --test tests/database.test.cjs tests/backup.test.cjs tests/task-library.test.cjs tests/notifications.test.cjs tests/subject-deletion.test.cjs tests/focus-timer.test.cjs tests/auth.test.cjs tests/theme.test.cjs tests/web-platform.test.cjs tests/dashboard-performance.test.cjs tests/material-files.test.cjs
npx.cmd expo install --check
npx.cmd expo export --platform android --platform ios --platform web --output-dir .expo/verification
```

In separate PowerShell processes, set TZ to Asia/Singapore or America/New_York and run the database suite. This changes the test process, not the phone timezone. Node 24 is verified for node:sqlite and the VM harness. Tests replace native UI bridges; exports confirm bundling, not physical-device gestures/appearance.

## Routing and Appwrite Troubleshooting

- Bootstrap: index.js -> expo-router/entry -> src/app/_layout.tsx -> App.js. Active tabs use nested journal/ and library/ stacks. Preserve the separate root app/index.tsx experiment.
- Unexpected phone screen: confirm terminal working directory, Metro's root message and the QR/server being opened; restart with npx.cmd expo start --clear before moving routes.
- Real Appwrite requires correct public endpoint/project/platform values in appwriteConfig.js. The active adapter is currently real. Keep server API keys outside the mobile client. Authentication does not enable cloud study-data synchronization.
- Native file paths exported from another device may not resolve. Store/share the actual external file separately; backups include references only.
- Source/history ZIP generation remains scripts/create-handoff.ps1, with ignored output under handoff/. Read the archive's ARCHIVE_README.md before restoring; device SQLite and remembered logins are not inside source archives.


## UI Polish Acceptance Checks (2026-10-29)

- Load the six-month Mock demo and scroll Journal rapidly to older entries; open both entry kinds, read full text, edit/save, cancel edits, confirm/cancel deletion and use native Back. Verify no duplicate write or lost failure draft. Journal details must be full screens; New Entry and post-session reflection remain sheets.
- In Library, verify the total count is a header pill and Add Subject is visible above the shelves. Shelf + still prefills the field. Reveal/close covers on narrow phones and large-text settings, then open books repeatedly. Check title/code/action wrapping, uninterrupted paper rows, Materials placement and both back directions in Light/Dark. iOS animated shelves intentionally disable native clipping.
- In Schedule Session, toggle Switch to 12h / Switch to 24h and verify Start/End instants and duration do not change. Check native dialogs, other timestamp labels and cold-boot persistence. Settings must no longer show a clock switch.
- Leave a focus timer running while navigating tabs: elapsed display stays accurate, while Journal/Library should remain responsive. Background/foreground and midnight still detect missed blocks and dates. Watch real device frame times in a release/development build; automated identity tests do not establish a device speedup.
- Weekly Progress should use a restrained green curve/fill, retain zero days/clean hour labels, and open the correct day through large point hit targets. A background tap still opens the weekly summary.
- USER_MANUAL.txt remains unchanged as requested; use this dated addendum for the explicitly requested Journal/time-control UI differences.
