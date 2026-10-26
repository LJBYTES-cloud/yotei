# Demo, Testing, and Troubleshooting

## Start the Native App

```powershell
npm.cmd ci
npx.cmd expo start --clear
```

Use the compatible SDK 57 Expo Go client or an up-to-date development build. Standard shells can use npm/npx without .cmd. `npx start -c` is incorrect. No dependencies were added in the reflection/material overhaul.

## Presentation Walkthrough

1. Sign in with the configured Appwrite account. Load Demo Data now appears for both adapters. To use the built-in Mock account instead, explicitly set USE_REAL_AUTH=false and fully reload, then use student@yotei.demo / study12345. The adapter is not switched automatically.
2. Settings > Load Demo Data replaces only this account's local study records. The replacement warning remains visible. It keeps authentication and other accounts intact and returns to Home.
3. Home shows today's 240 planned minutes, coaching examples and Weekly Progress. Previous six dates have 60/90/75/120/105/150 completed minutes. Today includes only elapsed completed sessions, so it may show zero. Planned workload and completed progress are different metrics.
4. Tap a graph point: the themed dialog shows its date, Total Minutes, specific completed tasks, allocated session time, studied/break/elapsed minutes and any finish after scheduled end. Tap the graph background: Total Studied This Week, Daily Average (all seven dates), Best Day. Tap a date row for its details. Empty days show zero and No Completed Sessions. Point taps must not open the aggregate summary instead.
5. Library shows coded, vibrant gradient spines in both themes. Tap a spine, reverse with Close, reopen, and tap the cover to enter its notebook. Dark-mode code/title text remains light and readable. Test shelf + field prefill, custom/existing field dropdown, long titles, editing and confirmed deletion.
6. In a notebook, tasks show editable multiline descriptions. New Task preselects that subject. Edit title/subject/description; clear the description; verify IDs/history remain. Delete requires confirmation. A new future scheduled session hides a task's old Missed Session badge while Home keeps its missed history.
7. Study Materials contains one demo website link per subject. Add a Title and URL / File Path; open it, edit it and delete it through confirmation. Websites open via the OS. Absolute local paths must exist on this device and have an available handler/permission; failure shows a recoverable error. No upload or file copy occurs, and deletion removes only the stored reference.
8. Schedule a session using native dates/times and optional duration (5m, 2h, 4h 30m). Today already has 240 planned minutes: adjust/cancel inserts nothing; Schedule Anyway explicitly overrides. Pick next week or an overnight window to check selected-date validation and per-day workload.
9. At the session's start, choose Start Session. Take Break freezes work; Resume Work resumes it. Finish Session saves actual work, excludes breaks, updates Weekly Progress and opens Reflect on This Session. Enter a quick note and Save Reflection, or Skip. A failed note save retains the draft and never undoes the completed block.
10. Reflections displays three linked demo notes plus saved notes, grouped by subject with newest first. Add a standalone note. There are no rating buttons, review intervals or due dates. Success uses a bottom toast, not an inline card.
11. Check that each success slides above the tab bar and disappears after three seconds, including repeated identical messages. Switching to Settings discards it. Settings never displays backup/demo/reflection success notices, and returning does not replay them. Errors remain inline.
12. Toggle Light/Dark and cold restart: saved choice restores; a fresh/missing preference defaults Light. Tap info icons on screens and inside sheets: Merriweather/Inter themed dialogs scroll and dismiss with OK/close/backdrop/Android Back without changing drafts.
13. Export a backup through Settings and save the shared JSON. Add a temporary subject, then import: it disappears and all lists/chart refresh. Version 5 includes descriptions, reflections/session links and materials; versions 1-4 convert review topics into notes. Invalid/canceled imports preserve data. See DATA_BACKUP.md.

Reload demo data on a new date; existing seeded sessions do not move automatically.

## Acceptance Checks

| Flow | Check |
| --- | --- |
| Auth | Welcome Back heading, validation, password visibility, loading/errors, trimmed email, remembered/cold-boot session behavior, sign-out |
| Demo | Both auth adapters show the button; repeat loading gives 3 subjects / 6 tasks / 10 blocks / 3 reflections / 3 materials; other accounts unchanged |
| Colors/theme | Identical vibrant gradients in both themes; light ink on dark book labels; theme persists, fresh fallback Light |
| Descriptions | Create/edit/clear multiline descriptions; failure retains drafts; omitted service updates preserve descriptions |
| Materials | Owned CRUD, confirmation, website/path opening and recoverable OS errors; no upload or original-file deletion |
| Calendar | Today at 5 PM is valid at 4 PM; passed instants reject; future dates/midnight/DST preserve duration and per-day workload |
| Timer | One active per account; precise breaks, lateness, background/cold restore, active sessions reachable beyond end/midnight |
| Reflection | Finish persists done first; note attaches correct subject/block; Skip/failure never reverts done; standalone notes allowed |
| Reflection migration | Upgrade with old topics: IDs/subjects/text preserved as notes; old schedule retired; failed migration rolls back and can retry |
| Deletion | Subject cascades dependent records; task deletes blocks but retains journal notes with null session links and material notes |
| Progress | Zero-filled week; done-only actual minutes; legacy untimed fallback; ownership; day details sum to chart total; allocated/break/elapsed/overrun match SQLite |
| Chart interaction | Point and background have separate actions; summary day rows are accessible; dialogs handle errors, empty days and both themes |
| Recommitment | Elapsed unstarted scheduled blocks become missed; replacement preserves history and increments postpone_count exactly once; coaching after 2 |
| Keyboard | Auth, note forms and every sheet keep the focused input visible; long text and OS text scaling remain usable |
| Toast | Single host above actual tab bar; 3 seconds per notice; no Settings display/replay; hidden notices still expire |
| Info dialogs | Correct theme/fonts, scrollable long text, all dismissal paths, nested sheet usage; destructive confirmations remain native |
| Backup | Version-5 round-trip/legacy conversion, linked ID remapping, other-account isolation, cancellation, malformed data and rollback |
| Browser | Mobile-only notice; no SQLite/WASM loader; native features remain Android/iOS only |

For missed-block demos, schedule the next whole minute for one minute, wait for its end and the next detection tick (up to 30 seconds), then reschedule. Repeat to demonstrate postponement coaching. Automated tests exercise this without waiting.

## Automated Commands

```powershell
npx.cmd expo lint
npx.cmd tsc --noEmit
node --experimental-vm-modules --test tests/database.test.cjs tests/backup.test.cjs tests/task-library.test.cjs tests/notifications.test.cjs tests/subject-deletion.test.cjs tests/focus-timer.test.cjs tests/auth.test.cjs tests/theme.test.cjs tests/web-platform.test.cjs
npx.cmd expo install --check
npx.cmd expo export --platform android --platform ios --platform web --output-dir .expo/verification
```

In separate PowerShell processes, set TZ to Asia/Singapore or America/New_York and run the database suite. This changes the test process, not the phone timezone. Node 24 is verified for node:sqlite and the VM harness. Tests replace native UI bridges; exports confirm bundling, not physical-device gestures/appearance.

## Routing and Appwrite Troubleshooting

- Bootstrap: index.js -> expo-router/entry -> src/app/_layout.tsx -> App.js. Active tabs use reflections.tsx and the nested library stack. Preserve the separate root app/index.tsx experiment.
- Unexpected phone screen: confirm terminal working directory, Metro's root message and the QR/server being opened; restart with npx.cmd expo start --clear before moving routes.
- Real Appwrite requires correct public endpoint/project/platform values in appwriteConfig.js. The active adapter is currently real. Keep server API keys outside the mobile client. Authentication does not enable cloud study-data synchronization.
- Native file paths exported from another device may not resolve. Store/share the actual external file separately; backups include references only.
- Source/history ZIP generation remains scripts/create-handoff.ps1, with ignored output under handoff/. Read the archive's ARCHIVE_README.md before restoring; device SQLite and remembered logins are not inside source archives.
