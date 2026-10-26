# Demo, testing, and troubleshooting

## Start the native demo

From the project root:

```powershell
npm.cmd ci
npx.cmd expo start --clear
```

Scan the QR code with the compatible native Expo Go client. The package/script form is `npm run start -- --clear`; `npx start -c` is incorrect because it tries to execute a different npm package.

In environments where normal shims work, the standard commands are `npm ci` and `npx expo start --clear`.

The native scheduler now includes `@react-native-community/datetimepicker` 9.1.0, installed through Expo. Rebuild an existing custom development client after adding this native module. The matching SDK 57 Expo Go client already includes the module, as recorded in the [versioned picker docs](https://docs.expo.dev/versions/v57.0.0/sdk/date-time-picker/).

## Demo walkthrough

1. Confirm `USE_REAL_AUTH = false` in `auth/index.js` and fully reload if the adapter flag was changed.
2. Use **Sign in to demo**, or enter `student@yotei.demo` / `study12345`. Leave Remember me off unless testing restoration.
3. In Settings, select **Load Demo Data**. The in-app hint identifies that this replaces the current demo account's study data.
4. Home shows 4 hours of planned/completed study and coaching for two postponed tasks. Elapsed seeded blocks are done; remaining blocks are scheduled.
5. Library shows Mathematics, Biology, History as gradient book spines grouped under Mathematics, Biology/Chemistry, and Humanities, plus six tasks. Tap a book to filter; tap it again or **Show All Tasks** to reset. Use its pencil to edit: confirm pre-filled name/field/colors, change them, and save. Verify the book moves to its updated field, the active filter still works, and linked task/review names/colors refresh. Verify titles, binding/page lines, selection indicators, task counts, and horizontal browsing.
6. Select Schedule on a task. Use Start's native calendar and clock to select a future time today, then choose an End date/time five minutes later. Today's demo already has 240 minutes, so the workload warning appears. Adjust or explicitly choose Schedule anyway. Overnight sessions select a later End date; workload is checked for each affected calendar day.
7. Once the session's start time arrives, choose Start Session on Home. Check the live elapsed timer and lateness message. Take Break, wait briefly, and confirm work freezes while break time grows. Resume Work and then Finish Session. The actual studied total is saved and the optional review-topic prompt opens. Finishing while still on break is also supported.
8. Choose Yes, add a topic. Enter a topic and save it. Its subject comes from the completed block, not a new manual subject selection.
9. Open Review: the three seeded due topics and the new topic are listed. Verify the Hard/Good/Easy buttons have no interval labels, popup guidance, or screen-reader interval announcements. Rate a topic: it leaves the due list and shows "Review saved." The underlying review intervals are unchanged.
10. Open Add subject: enter a Field of Study and choose one or two colors from twelve swatches, including Black and White. Verify every option has a visible colored circle in both themes. A third choice is disabled until one is removed. In Light mode, books must retain gradients, paper title labels, and binding/page details; task subject selectors remain monochrome. Add another subject under the same field and verify both share a horizontally scrolling shelf. Settings must label the current Dark Mode/Light Mode, with a black/white switch in Light mode. Toggle Light, cold restart, and confirm Light is restored; repeat for Dark. Confirm the small motto appears at the bottom of Home and is absent from Settings.
11. In Settings > Data Management, export a backup and save the JSON using the native share sheet. Add a temporary subject in Library, then import the saved JSON. Confirm the temporary subject disappears and Home/Library/Review refresh. See [DATA_BACKUP.md](DATA_BACKUP.md) for cancellation, rollback, and account-isolation checks.
12. Schedule another block for a date next week, including a morning time earlier on the clock than now. Confirm the saved-date notice and exported record show the chosen date. Home remains Today's Focus, so future blocks appear there when that date arrives.
13. Tap the small info icons next to labels/titles. Check that guidance appears in a brief native popup and dismisses cleanly without changing a draft. Inspect the bookshelf's page lines/binding details and a long subject name in both themes.

The demo seed is day-relative. Reload it on a new date to obtain today's four-hour data; do not expect old seeded sessions to move to a new date automatically.

## Manual acceptance checks

| Flow | Check |
| --- | --- |
| Authentication | Required fields, password visibility, loading/errors, sign-out, account-scoped data |
| Remember me off | Session works in the current launch; a real cold restart requires login |
| Remember me on | Public session restores; sign-out clears it; test custom mock-account limitations described in PROJECT_CONTEXT |
| Subject/task creation | Field text required; choose one/two distinct colors, no third or empty selection; forms retain drafts on failure; linked task/review markers still work |
| Task editing | Edit prefills title and subject. Change both and save: task keeps its ID/history, moves to the selected subject, updates joined Home labels, and keeps deadlines/counts. Cancel leaves data unchanged; save failure retains the draft. Verify both themes |
| Task deletion | Delete opens native Cancel/Delete confirmation. Cancel/dismiss preserves data. Confirm removes the task and all study blocks, including missed/replacement/active records; subject reviews/material notes stay. Lists/counts/workload refresh across tabs. Rapid taps insert no duplicate operation; failures unlock retry |
| Library missed badge | Let a block expire; task shows Missed Session. Schedule a fresh block for later today or next week from Library: badge disappears, while Home still shows the old unresolved miss. A past/done block or another task's commitment must not suppress it; coaching at postpone_count >= 2 remains |
| Subject editing | Pencil opens a pre-filled sheet in both themes without filtering the task list; Save changes updates the same row and shared tabs; Cancel changes nothing; invalid input retains the draft; imported colors remain selectable; Add subject starts a fresh form after closing the editor |
| Subject deletion | Create a temporary subject with a task, block and review. Select its task filter, open its pencil, and find the red Delete Subject button below Save changes. Cancel (or dismiss on Android) preserves the draft and all data. Reopen confirmation and Delete: sheet closes, subject/linked data disappear across tabs, and Library shows remaining tasks without a stale filter. Verify both themes and failure/retry/loading feedback; no delete button appears in Add Subject/Add Task |
| Theme persistence | Light and Dark each restore after a cold restart, including before sign-in; rapid toggles retain the last choice; sign-out/import leave the preference intact; Settings labels the current mode and Light mode has no green toggle tint |
| Browser guard | Open with `npm run web`: show the mobile-only notice, with no SQLite/WASM request or error; native login and study storage remain available on Android/iOS |
| Subject migration | Upgrade an existing database: subject names/IDs/colors and linked tasks/reviews/materials survive under General; no reset required |
| Native schedule | Pick today, tomorrow, next week, and a year-boundary date; verify chosen local start/end dates and stored instants |
| Passed-time validation | At 4 PM today, 5 PM today is valid; earlier today is rejected; tomorrow morning is valid; an end at/before the start is rejected |
| Picker cancellation | Cancel an Android calendar/clock dialog and verify dates/draft stay unchanged; dismiss iOS picker popovers and verify normal native behavior |
| Overnight scheduling | Select a later End calendar date; verify each local day's 240-minute check uses only that day's portion |
| Info popups | Label/title icons show guidance; background fields retain drafts. Errors and import/workload warnings remain visible without opening a popup |
| Task estimates | New and existing task cards omit non-editable estimated-minute text; postponement counts remain visible |
| Subject bookshelf | Verify grouped horizontal shelves, one-color shading/two-color gradients in both themes, visible paper titles/binding/page detail, long/scaled text, filtering/counts, and reset after demo/import |
| Workload | Exactly 240 minutes is permitted; adding more warns; Cancel/Adjust inserts nothing; explicit confirmation inserts once |
| Focus timer | Start within the scheduled window; elapsed work updates each second; lateness is shown; other Start buttons are disabled while a session is active. Missed blocks still require rescheduling |
| Break tracking | Take Break freezes work and starts current/total break time; Resume Work excludes breaks; repeated short breaks accumulate precisely; Finish during a break excludes the open break |
| Timer restoration | Switch tabs/background/cold restart during work and during a break. Work/break mode and elapsed totals restore. Active blocks remain reachable past scheduled end and midnight; they are not auto-missed |
| Actual completion | Finish stores actual end, studied seconds, and break minutes; done cards show the saved total. Retry cannot reset timestamps or inflate totals; failed actions show an error and can be retried |
| Completion prompt | Yes creates a due topic under the correct subject; No/Skip creates none; block remains done in either case |
| Missed blocks | A scheduled block ending in the past becomes missed on load/refresh/foreground/timer detection |
| Recommitment | Reschedule preserves the original; a replacement is linked; task count rises once per replacement, including rapid retries |
| Coaching | After two actual replacement events, the task's coaching action is visible |
| Review | New topics are immediately due; rating hides them until their next due time; another account cannot view or rate them |
| Keyboard | Subject/Task name and completion/review topic remain visible while typing; the scheduler uses native pickers without a text keyboard |
| Empty states | Home: No study blocks scheduled for today. Review: You're all caught up on reviews. |
| Demo reset | Repeated loading produces 3 subjects/6 tasks/4 blocks/3 reviews without affecting another account |
| Data backup | Export/save JSON; import replaces only the signed-in account; picker cancel/invalid files preserve current data; verify both themes and loading/error feedback |

For a short live missed-block demonstration, use the native clock to choose the next whole minute for Start and one minute later for End, then close the sheet. Wait for its end plus the next detection tick (up to about 30 seconds while active), or pull to refresh. Reschedule it and repeat to demonstrate a count of 2. Automated tests exercise the same flow without waiting or changing the device clock.

## Automated commands

```powershell
npx.cmd expo lint
npx.cmd tsc --noEmit
node --experimental-vm-modules --test tests/database.test.cjs tests/auth.test.cjs tests/backup.test.cjs tests/theme.test.cjs tests/subject-deletion.test.cjs tests/focus-timer.test.cjs
```

Date-sensitive database coverage can run in separate PowerShell processes with:

```powershell
$env:TZ = 'Asia/Singapore'
node --experimental-vm-modules --test tests/database.test.cjs
```

```powershell
$env:TZ = 'America/New_York'
node --experimental-vm-modules --test tests/database.test.cjs
```

These variables affect the test process. They do not change the phone's timezone. Node 24 is the verified environment for `node:sqlite` and the VM-module test harness.

Run one specific full-loop test with:

```powershell
node --experimental-vm-modules --test --test-name-pattern="study completion feeds review" tests/database.test.cjs
```

Compile native bundles with:

```powershell
npx.cmd expo export --platform android --platform ios --output-dir .expo/verification
```

Export success confirms bundling and asset resolution. It does not install the app or verify native keyboard/modal gestures.

## Routing and startup troubleshooting

- Current bootstrap is `index.js` -> `expo-router/entry` -> `src/app/_layout.tsx` -> `App.js`.
- Current Metro exports select `src/app/`. The root `app/index.tsx` Hello World experiment is preserved but is not the implemented app screen.
- If the phone shows an unexpected page, confirm the terminal's working directory and the QR code/server being opened. Restart Metro with `npx.cmd expo start --clear` and inspect its root-directory message before changing files.
- Do not replace the entry with the older registerRootComponent bootstrap while retaining Expo Router routes.
- If PowerShell refuses `npx.ps1`, use `npx.cmd` rather than changing machine execution policy just to run Expo.
- When dependency compatibility is in doubt, use `npx.cmd expo install --check`; apply version fixes only after reviewing the reported changes.
- The browser intentionally shows a mobile-only notice before authentication/study routes mount. `db/database.web.js` prevents SQLite/WASM from entering the web bundle; Android/iOS continue using the native database. Browser study functionality is not implemented.

Run the web guard regression checks with `node --experimental-vm-modules --test tests/web-platform.test.cjs`. They verify the import-free web database, mobile notice, and unchanged native route mounting. `npx.cmd expo export --platform web --output-dir .expo/web-guard-verification` also checks Metro's platform resolution.

## Real Appwrite setup boundary

`appwriteConfig.js` contains public client values and `auth/index.js` selects the adapter. Real authentication is currently enabled (`USE_REAL_AUTH = true`). For a Mock demo, set the flag to false and fully reload; Mock registrations cannot create accounts in Appwrite. Keep server API keys outside the mobile app.

For real login diagnostics:

1. Restart with `npx.cmd expo start --clear` and fully reload the native app. Check for `[AppwriteAuthService] Client initialized` in the development console. It reports the public endpoint, projectId, and platform actually passed to the SDK.
2. Compare those values with the same Appwrite Console project's endpoint/ID and registered Android/iOS platform (`com.yotei.app`). A local config check cannot establish that the Console account being inspected is in that project.
3. Attempt Sign In with an existing project's user account. The adapter trims email and preserves the password. If it fails, capture the `[AppwriteAuthService] signIn failed` entry's exact `code`, `message`, and `type`.
4. Signup failures log `[AppwriteAuthService] signUp failed` with the same details and propagate to the visible error. If creation succeeds but automatic login fails, both operation labels appear; the account may already exist even though signup as a whole failed.

A read-only guest request to the current endpoint/project returned `401 general_unauthorized_scope` on 2026-10-21. No credentials or creation request were sent. This establishes reachability and the guest account permission check, not successful login or platform registration. Appwrite documents [client configuration](https://appwrite.io/docs/quick-starts/react-native) and [error codes/types](https://appwrite.io/docs/apis/response-codes); use the actual error type to distinguish invalid credentials, duplicate email, or project/platform configuration failures.

The mock-only demo loader then disappears. Local study services remain SQLite-backed and still scope data to the normalized `user.id`; enabling Appwrite authentication does not enable cloud study-data synchronization.

## Portable handoff restoration

Open the generated ZIP and read its `ARCHIVE_README.md` first. The `source/` directory is the current working-tree snapshot, including these documents and the local `app/index.tsx` experiment. It can be extracted into a fresh folder, followed by `npm ci`.

The separate `.bundle` file, also included under `history/` inside the ZIP, restores committed Git history:

```powershell
git clone path\to\yotei-handoff-2026-10-21.bundle restored-yotei
```

The bundle does not include uncommitted handoff documents/experiments; use the source snapshot to recover those. No device database or remembered login is backed up by this package.
