# Implementation history and decisions

This consolidates the feature requests and reworks through the 2026-10-21 handoff. The current implementation and [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) take precedence over earlier intermediate designs.


## Performance and UI Polish (2026-10-29)

- Preserved finalized USER_MANUAL.txt, study rules, schema, backup version 6, authentication and four tabs. Journal previews now open the requested dedicated note screen; the saved clock-format control moved from Settings into Schedule Session.
- Removed workspace clock ticks, split stable list state from notices/sheets, stabilized actions and reconciled unchanged query results. Focused Home/notebook clocks stop offscreen/backgrounded. FocusTimer retains its independent one-second clock.
- Retained bounded virtualized lists, added horizontal book virtualization and memoized notebook/material rows. Animated book faces avoid iOS native clipping; covers fit shelf width. Demo writes reuse fewer than 20 compiled SQL shapes for hundreds of blocks inside the same rollback-safe transaction.
- Added Library header action/count, cleaner notebook wrapping/actions/page boundaries, and consistent themed native transitions. Chart curves/fill are restrained; real data, hour ticks and point hit targets remain.
- Full-page Journal keeps both entry kinds, validation, confirmed deletion, retry drafts and immediate saved text. Corrected demo visibility to match the existing USE_REAL_AUTH === false mutation guard.
- Validation: clean lint/typecheck; **205 cases: 204 passed, 0 failed, 1 existing timezone skip**; **73 database tests passed in America/New_York**; Android/iOS exports passed. Native FPS/latency and gestures require the device checks in DEMO_AND_TESTING.md.

| File | Change |
| --- | --- |
| `README.md` | **Updated.** Updated current Library, Journal, clock control and performance overview. |
| `components/FocusTimer.js` | **Updated.** Uses stable list state; work/break clock remains local. |
| `components/JournalDetailSheet.js` | **Removed.** Removed modal-only reader; replaced by JournalEntryContent and dedicated screen. |
| `components/JournalEntryContent.js` | **Created.** New full-page note content/editor; both entry kinds, confirmation, retry drafts and immediate saved text. |
| `components/ScheduleSheet.js` | **Updated.** Added saved 12h/24h control beside Session Times without changing selected instants. |
| `components/StudyCards.js` | **Updated.** Memoized TaskCard, narrowed row subscriptions and added header action/count support. |
| `components/StudyMaterials.js` | **Updated.** Memoized owned material filtering/section and uses stable list state. |
| `components/StudyWorkspace.js` | **Updated.** Split list subscriptions from notices/sheets, stabilized actions, removed shared clock ticks and routed Journal details. |
| `components/SubjectBookshelf.js` | **Updated.** Virtualized horizontal books and fitted covers to measured shelf width; retained reversible animations. |
| `components/WeeklyProgressCard.js` | **Updated.** Memoized data, smooth bezier curve and subtle fading accent fill; preserved values/touch actions. |
| `components/studyStyles.js` | **Updated.** Added wrapping title/action layout and subject-count pill. |
| `db/seedData.js` | **Updated.** Reuses/finalizes compiled SQL inside the same owned, atomic six-month seed transaction. |
| `docs/CHANGELOG.md` | **Updated.** Recorded this implementation and complete per-file summary. |
| `docs/DEMO_AND_TESTING.md` | **Updated.** Updated Journal/clock walkthroughs and added native performance/layout acceptance checks. |
| `docs/NEXT_SESSION_PROMPT.md` | **Updated.** Updated continuation context for routes, clock controls and stable state. |
| `docs/PROJECT_CONTEXT.md` | **Updated.** Updated architecture, component map and current UI/performance contracts. |
| `docs/VALIDATION.md` | **Updated.** Recorded tests/exports, SQL reuse evidence and physical-device verification limits. |
| `hooks/useDashboardData.js` | **Updated.** Reconciles unchanged query rows/arrays and memoizes the returned data snapshot. |
| `hooks/useScreenClock.js` | **Created.** New focused-screen readiness clock with foreground catch-up and blur/background cleanup. |
| `screens/HomeScreen.js` | **Updated.** Uses stable list state and local readiness clock; active timer ticks stay isolated. |
| `screens/JournalEntryScreen.js` | **Created.** New full-page keyboard-aware owned note route with writing/back guards and stale-ID handling. |
| `screens/JournalScreen.js` | **Updated.** Uses stable list state while retaining memoized, virtualized chronological previews. |
| `screens/LibraryScreen.js` | **Updated.** Moved Add Subject/count to header and disabled problematic iOS shelf clipping. |
| `screens/OpenedBookScreen.js` | **Updated.** Memoized/keyed task rows, safer wrapping/stacked actions and clean notebook/material separation. |
| `screens/SettingsScreen.js` | **Updated.** Removed time-format switch and corrected demo visibility to match the existing Mock-only guard. |
| `src/app/(tabs)/journal.tsx` | **Removed.** Removed flat wrapper, replaced by nested Journal routes. |
| `src/app/(tabs)/journal/[entryId].tsx` | **Created.** New namespaced entry/reflection detail wrapper. |
| `src/app/(tabs)/journal/_layout.tsx` | **Created.** New themed Journal stack retaining the same tab and native back navigation. |
| `src/app/(tabs)/journal/index.tsx` | **Created.** New feed wrapper for JournalScreen. |
| `src/app/(tabs)/library/_layout.tsx` | **Updated.** Consistent native slide-right notebook transition on themed background. |
| `tests/dashboard-performance.test.cjs` | **Created.** New actual-hook tests for 1,000-row stability, one-row edits/reordering and local clock cleanup. |
| `tests/database.test.cjs` | **Updated.** Prepared SQL transport/reuse/finalization checks; retained rollback, seed and ownership coverage. |
| `tests/focus-timer.test.cjs` | **Updated.** Updated bridge for stable list subscription; retained timer lifecycle checks. |
| `tests/notifications.test.cjs` | **Updated.** Updated bridge for split subscriptions; retained toast/dialog regressions. |
| `tests/task-library.test.cjs` | **Updated.** Updated shelf/notebook coverage and added dedicated Journal, stable context, header and clock-control checks. |
| `utils/stableData.js` | **Created.** New flat-row reconciliation by ID/date; preserves unchanged object/array identities across refreshes. |

No dependencies or native configuration changed. The removed detail-sheet/flat wrapper are replaced by the content component/nested routes; no study records or manual content were deleted.

## Scheduled-Card Kebab and Active-Session Notice (2026-10-27)

- Reverted the three-button action row. Scheduled cards now have only the full-width primary Start Session button; the top-right kebab beside time/status contains exact Mark as Done and Delete Block actions. Status text can shrink/wrap while keeping the menu touch target. The existing themed block-deletion modal remains connected.
- ItemActionsMenu accepts custom label/onPress/tone actions or the backward-compatible optional Edit/Delete callbacks with custom labels. Existing task/material defaults remain. Callbacks still wait for iOS dismissal or Android's post-commit frame before opening another modal; busy/disabled/duplicate choices are guarded.
- Another active or paused session no longer disables an otherwise eligible Start button. The start-only workspace check posts **You already have a session in progress. Finish it before starting a new one.** and returns before SQLite/mutation state. Early-window/pending-action disabling stays in place; pause/resume continue normally. Removed unused canStart plumbing and old row styles.
- Validation: lint/typecheck, 45 focused UI tests, full regression with 195 passes/one existing timezone skip (196 cases), and Android/iOS exports passed. No dependency/schema/database-service changes.

| File | Change |
| --- | --- |
| `components/ItemActionsMenu.js` | Added custom action arrays/labels and optional legacy callbacks; retained default Edit/Delete behavior and deferred action dispatch. |
| `components/StudyCards.js` | Moved scheduled secondary actions into the header kebab and kept one primary Start button without the active-session disabling prop. |
| `components/studyStyles.js` | Replaced obsolete three-button row styles with a shrinkable status/menu header group. |
| `screens/HomeScreen.js` | Removed unused canStart calculation, prop and callback dependency. |
| `components/StudyWorkspace.js` | Added the start-only active-session notice and early return before SQLite; retained pause/resume and mutation guards. |
| `tests/task-library.test.cjs` | Covered custom menus/dismissal/duplicates, secondary-action wiring, eligible start clicks, exact conflict notice/no service call and unaffected break/resume. |
| `README.md` | Updated the scheduled-card/menu and active-session UX overview. |
| `docs/PROJECT_CONTEXT.md` | Updated menu API, current layout and start-guard contracts. |
| `docs/NEXT_SESSION_PROMPT.md` | Replaced the superseded action-row contract with current menu/notice behavior. |
| `docs/DEMO_AND_TESTING.md` | Added menu-to-confirmation and active/paused-session toast acceptance checks. |
| `docs/VALIDATION.md` | Recorded current tests/exports and remaining physical-device checks. |
| `docs/CHANGELOG.md` | Recorded this update and the complete 12-file summary. |

Twelve existing files updated; no files created or deleted in this pass. Pre-existing work remains intact.

## Themed Block Deletion and Scheduled-Card Action Row (2026-10-27)

- Replaced scheduled-block native Alert with a themed BlockDeletionModal: Merriweather heading/task, Inter body/buttons, matching light/dark surfaces, Cancel and destructive Delete Block. Idle backdrop/Back/accessibility escape cancel without writes; pending deletion locks dismissal and duplicate submissions. Failure stays in the dialog for retry; success closes it and refreshes shared data. Other record confirmations retain their current behavior.
- Scheduled cards now show Start Session, Mark as Done and Delete Block in one horizontal space-between row. Start has a larger 1.6 flex share and filled primary styling; compact secondaries have one share each. Centered wrapping labels, zero minimum width and smaller padding retain the row on narrow screens without fixed-height text clipping. Start remains visible but disabled before its scheduled window or while another timer is active.
- Added optional shared Button style/textStyle overrides; default buttons retain their styling and pressed/disabled behavior. No dependency, schema or database-service changes.
- Validation: lint/typecheck passed, 49 focused UI tests passed, full regression reported 193 passes/one existing timezone skip (194 cases), and Android/iOS exports passed. Physical-device layout/touch checks remain manual.

| File | Change |
| --- | --- |
| `components/BlockDeletionModal.js` (created) | Themed, accessible confirmation dialog with loading, error/retry display and guarded cancellation/confirmation. |
| `components/StudyWorkspace.js` | Own the block-deletion selection/busy/error state, lock competing actions, perform the existing owned delete and refresh, and keep failures retryable. |
| `components/StudyCards.js` | Render all three scheduled actions in one row with a larger primary Start and smaller secondary actions; preserve start eligibility. |
| `components/studyStyles.js` | Add responsive row, flex sizing, padding and wrapping label styles. |
| `components/ui.js` | Accept optional Button container/text styles while preserving shared defaults and interaction states. |
| `tests/task-library.test.cjs` | Update confirmation tests for the custom modal and add row/eligibility, no-Alert, cancellation, duplicate, pending, ownership/status and failure/retry coverage. |
| `tests/notifications.test.cjs` | Verify confirmation typography/colors in both themes, cancel/confirm paths and busy guards through the actual modal component. |
| `docs/PROJECT_CONTEXT.md` | Document the themed deletion state/locks and scheduled action-row behavior. |
| `docs/NEXT_SESSION_PROMPT.md` | Add the new modal and button-layout contracts for continuation. |
| `docs/DEMO_AND_TESTING.md` | Add both-theme, narrow-screen, larger-text and deletion-interaction checks. |
| `docs/VALIDATION.md` | Record current test/export evidence and physical-device limits. |
| `docs/CHANGELOG.md` | Record this update and the complete 12-file summary. |

One file created, 11 existing files updated, no files deleted in this pass. Pre-existing work is preserved.

## Settings, Manual Completion, Journal Management, and Coach (2026-10-27)

- Restored strictly Mock-only demo rendering and guarded the reset action; real auth remains enabled. New Subject Code drafts are empty with the exact e.g. GEN-101 placeholder; saved/migrated codes remain intact. Duration replacement explicitly recalculates End from the selected Start, with rapid-edit/save regressions. Data Management again exposes themed JSON-backup guidance.
- Added device-wide 24-Hour Time, default ON, restored before screens mount and saved in order to AsyncStorage. Shared formatting covers scheduled times, journal dates, completion logs and coach hour suggestions. Elapsed counters and study-hour axes remain durations. Android uses is24Hour; iOS uses a formatted time button and locale-controlled native spinner, retaining the compact calendar.
- Scheduled Home blocks now support Mark as Done and confirmed Delete Block. Manual completion saves scheduled seconds, action-time completion and no invented actual start/breaks; retries preserve the first result. Progress credits the completion date and optional reflection still opens. Deletion keeps Task/other history. Backup version 6 validates and restores this new state using existing columns; no schema change.
- Journal previews are tappable and open full text in a themed keyboard-aware detail sheet. Both manual entries and automatic reflections support owned edit/delete with native confirmation, retryable drafts and duplicate locks. Manual titles/content and reflection notes are editable; reflection titles remain task-derived. Edits keep dates/links; note deletion does not delete sessions or change study totals.
- Added Display Name editing through both auth adapters and SessionContext. Appwrite updates the account name; Mock updates its memory/public SecureStore session without changing Remember Me. The UI updates immediately after success and keeps the same user ID. SQLite has no separate profile-name/session table, so study ownership stays intact.
- Coach priority is now overdue incomplete tasks, repeated postponement, planned workload >240, completed today+yesterday, then optional most-studied-hour advice after sufficient history. Calendar-day deadlines, streaks and historical hours use consistent JS/device time semantics; SQLite native-localtime conversion was removed after timezone testing exposed a mismatch. Exactly one message appears, or none if no rule matches.
- Verification: lint/typecheck, 191 passing tests plus one existing timezone-specific skip (192 cases), all 72 New York database tests, fractional-offset checks, and Android/iOS/web exports. Native gestures/rendering and live Appwrite rename still require a device. See [VALIDATION.md](VALIDATION.md).

### File-by-File Summary for This Update

| File | Change |
| --- | --- |
| `TimeFormatContext.js` (created) | Hydrated device-wide 12/24-hour preference, stable shared formatters, ordered AsyncStorage saves and safe fallbacks. |
| `utils/timeFormat.js` (created) | Locale-aware clock/date-time formatting, h23 midnight handling and invalid-value fallback. |
| `components/DisplayNameSheet.js` (created) | Keyboard-aware display-name editor with validation, duplicate guard, loading and retained error drafts. |
| `components/JournalDetailSheet.js` (created) | Full journal/reflection text, appropriate edit fields, owned saves and confirmed deletion. |
| `db/CoachService.js` (created) | Owned completion-day streak flags and sufficient-history best-hour aggregation using UTC buckets plus JS local conversion. |
| `App.js` | Mounted TimeFormatProvider between theme hydration and application/session screens. |
| `auth/AuthService.js` | Added validated display-name normalization and the updateName adapter interface. |
| `auth/AppwriteAuthService.js` | Implemented normalized Account.updateName with the current session. |
| `auth/MockAuthService.js` | Implemented session/memory name updates and remembered-name restoration without changing remember flags or persisting passwords. |
| `auth/SessionContext.js` | Immediate normalized profile updates, loading/competing-action guards and protection against replacing a different current user. |
| `auth/index.js` | Widened the adapter flag's static type to boolean for strict false checks; retained real mode. |
| `screens/SettingsScreen.js` | Strict Mock-only demo card, JSON-backup help, persisted time switch and Display Name edit action. |
| `components/EntrySheet.js` | Empty new Subject Code state and exact requested placeholder; editing keeps the saved code. |
| `components/ScheduleSheet.js` | Explicit Start-anchored duration replacement instead of deriving from a prior End. |
| `components/DateTimeField.js` | Shared formatted times, Android clock preference and expandable iOS locale-controlled native time spinner. |
| `components/theme.js` | Re-exported the shared clock formatter instead of maintaining a separate implementation. |
| `components/StudyCards.js` | Shared clock labels, scheduled Mark as Done/Delete Block actions and manual-completion feedback. |
| `components/StudyWorkspace.js` | Guarded manual completion/deletion, native block confirmation, shared journal-detail state/refresh, name-update busy state, Mock-only seeding and preferred-format schedule notices. |
| `screens/HomeScreen.js` | Wired scheduled-block actions and the new coach-history input while retaining memoized rendering. |
| `screens/JournalScreen.js` | Tappable four-line previews, preferred-format dates and shared full-detail opening with stable callbacks. |
| `components/ProgressDetailsModal.js` | Preferred-format scheduled windows and actual/manual completion timestamps. |
| `components/CoachCard.js` | New rule-history input and time-preference-aware best-hour note. |
| `utils/coaching.js` | Explicit overdue/postponement/workload/streak/best-time priority, complete-day deadline semantics and stable selection. |
| `db/StudyBlockService.js` | Serialized, owned, idempotent manual completion and scheduled-only block deletion preserving tasks. |
| `db/ProgressService.js` | Credit manually saved seconds on their completion day and keep day-detail totals consistent. |
| `db/BackupService.js` | Validate explicit manual completions while retaining legacy untimed and measured-timer validation. |
| `db/JournalService.js` | Owned update/delete for manual and reflection sources, preserving dates, links, tasks and study sessions. |
| `hooks/useDashboardData.js` | Load coach streak/hour history in shared refresh; removed unused lastCompleted hook state/query. |
| `tests/database.test.cjs` | Manual session/note CRUD, ownership, history preservation, new coach priorities, calendar/DST/fractional-time behavior and prior regressions. |
| `tests/backup.test.cjs` | Manual completion round-trip plus invalid-state rejection/rollback checks. |
| `tests/auth.test.cjs` | Adapter rename normalization, identity/remember preservation, cold restore and API/storage failure checks. |
| `tests/theme.test.cjs` | Generalized provider host and added time-preference hydration/order/remount/failure and clock-format tests. |
| `tests/task-library.test.cjs` | Actual Settings, duration, native clock, profile/session, scheduled-action, journal-detail and coach wiring/locking regressions. |
| `tests/web-platform.test.cjs` | Updated root-provider host while preserving native startup and web SQLite guard checks. |
| `README.md` | Updated supported settings, Mock visibility, journal actions, manual completions, name ownership and coach priorities. |
| `docs/PROJECT_CONTEXT.md` | Updated providers/service map, time/name/session/note/manual-completion contracts and current coach rules. |
| `docs/DEMO_AND_TESTING.md` | Updated Mock-only walkthrough and acceptance checks for clocks, profiles, manual blocks and journal management. |
| `docs/NEXT_SESSION_PROMPT.md` | Added current continuation contracts and superseded old coach/demo assumptions. |
| `docs/DATA_BACKUP.md` | Documented manual completion validation, excluded preferences/profile data and current demo-export checks. |
| `docs/VALIDATION.md` | Recorded dated full-suite, timezone, native export and component/adapter evidence plus device-only limits. |
| `docs/CHANGELOG.md` | Recorded this feature and the complete 41-file change summary. |

Five files created, 36 existing files updated, no project files deleted in this pass. No dependency/schema/backup-version changes; pre-existing work is preserved.

## List Performance, Six-Month Demo, and Rule-Based Coach (2026-10-27)

- Memoized Home focus rows, Journal entries, field shelves and books; stabilized renderers, keys and workspace actions. All three screen FlatLists use 10 initial items, batches of 10, windowSize 5 and removeClippedSubviews=true. Library now virtualizes vertical field shelves while retaining its horizontal animated books. Static focus cards receive narrow props instead of subscribing to the entire ticking workspace.
- Expanded the owned, atomic demo reset to six calendar months, 20 unique subjects across five fields, 40 uniquely titled described tasks, 40 references and hundreds of completed sessions. All tasks appear in history. Varied experiences/next steps combine with assignment/date/timing details to make reflection notes and manual journal titles/content unique. Today's four blocks still total exactly 240 planned minutes, with honest elapsed completion near midnight, older rest days and a populated recent week.
- Weekly Progress uses rounded whole-hour ticks and hour/minute labels. The ceiling follows real data, an empty week retains 0 to 1h, and extreme days use larger whole-hour steps to keep at most six intervals. Actual point values, touch targets and detail dialogs are preserved.
- Removed lateness computation/display from the active timer. The completion reflection sheet derives exact-on-time, subminute and whole-minute late feedback from persisted timestamps; missing starts get neutral completion text. Work/break accounting and timer transitions are unchanged.
- Added one Home Coach note with explicit priority: repeated postponement, >240 planned minutes, no completion within 72 hours, then latest actual work >1.5x allocation. The most-postponed task wins, with ID as a stable tie-break. No match hides the card. An owned all-history query provides the latest completion independently of Home's date-filtered list; the existing refresh pipeline updates it after actions/import/reset. Task-level notebook coaching remains.
- Validation: lint/typecheck passed; ten suites produced 173 passes, zero failures and one timezone-specific skip (174 cases); all 68 database cases passed in New York. Android/iOS exports passed. Native scrolling/clipping/frame performance and rendered gestures still need physical-device checks. See [VALIDATION.md](VALIDATION.md).

### File-by-File Summary for This Update

| File | Change |
| --- | --- |
| `components/CoachCard.js` (created) | Themed Merriweather/Inter mentor-note card showing one selected rule or nothing. |
| `utils/coaching.js` (created) | Pure ordered coach-rule selector, stable task selection, workload/72-hour/actual-work boundaries. |
| `utils/progressChart.js` (created) | Whole-hour axis ceilings/steps, bounded interval count and hour/minute labels. |
| `db/StudyBlockService.js` | Added validated, account-scoped latest completed-session lookup across all dates, using actual completion/fallback end and stable ID ordering. |
| `db/seedData.js` | Six-month, 20-subject/five-field/40-task/40-reference demo; hundreds of sessions and unique journal/reflection text; retained atomic isolation and today's 240-minute example. |
| `hooks/useDashboardData.js` | Fetch and expose lastCompleted in the existing guarded shared refresh. |
| `screens/HomeScreen.js` | Stable focus renderer/keys, requested list limits, narrow static-card props and one CoachCard replacing stacked postponement notes. |
| `screens/JournalScreen.js` | Extracted memoized timeline cards, stable renderer/keys and requested virtualization props. |
| `screens/LibraryScreen.js` | Replaced the all-shelf vertical ScrollView with a FlatList of memoized field shelves, stable callbacks and requested performance settings. |
| `components/SubjectBookshelf.js` | Memoized shelves/books, shared grouping helper and stable book-action callbacks; preserved reveal/return animation and field additions. |
| `components/StudyCards.js` | Memoized FocusCard with explicit readiness/loading/action props, avoiding unrelated workspace updates. |
| `components/FocusTimer.js` | Memoized active view; removed live lateness calculations/UI while preserving work/break ticking and actions. |
| `components/CompletionReflectionSheet.js` | Display saved-start timing feedback after completion, above the optional reflection note. |
| `components/WeeklyProgressCard.js` | Memoized chart card and integrated clean whole-hour bounds, segment count and formatted Y labels. |
| `components/StudyWorkspace.js` | Stabilized timer/reschedule/subject-entry/edit actions and updated the demo-load notice to six months/20 subjects/40 tasks. |
| `utils/focusTimer.js` | Separated completion-only start feedback from live work/break calculations. |
| `utils/subjectFields.js` | Added shared case-insensitive subject grouping for virtualized field shelves. |
| `tests/database.test.cjs` | Added owned history, coach priority/boundaries, clean-axis and completion-text cases; expanded six-month uniqueness/count/isolation/rollback checks. |
| `tests/task-library.test.cjs` | Added one-note/completion/virtualization/callback/readiness checks and updated actual-component hosts for memoized rows and field lists. |
| `tests/focus-timer.test.cjs` | Updated the actual timer host for memoization and verified no active lateness message while work/break/actions still behave correctly. |
| `README.md` | Updated demo size, coach priority, chart ticks, completion feedback and list-performance overview. |
| `docs/PROJECT_CONTEXT.md` | Updated component/service map and current coach, history, list, timer, chart and six-month seed contracts. |
| `docs/DEMO_AND_TESTING.md` | Updated presentation steps/counts and manual coach, axis, completion and scrolling checks. |
| `docs/NEXT_SESSION_PROMPT.md` | Added continuation context for the coach/query, list props, completion feedback, axis and expanded seed. |
| `docs/VALIDATION.md` | Recorded current commands/results, boundary/SQL/component coverage and physical-device limits. |
| `docs/CHANGELOG.md` | Recorded this implementation and this complete 26-file summary. |

Three files created, 23 existing files updated, no files deleted in this pass. No dependency/schema/backup-format changes. Earlier local changes remain intact.

## Feature slices

### Authentication foundation

- Installed Appwrite, URL polyfill, SecureStore, and safe-area support.
- Set `main` to `index.js`, loading the URL polyfill before application code.
- Introduced AuthService, MockAuthService, AppwriteAuthService, and the active-adapter flag.
- Both adapters normalize users to `{id, name, email}` and sign in after registration.
- Added the built-in student demo login and a dark authentication UI with validation, loading/error states, and password visibility.
- Added provider-specific remember-me flags. False means clear the session on the next cold boot; true permits restoration. The preference defaults off.
- Appwrite configuration began as placeholders; the current public client configuration has been populated. Mock mode remains active at handoff.

### SQLite and dashboard data

- Installed expo-sqlite; initialized `yotei.db` and five tables: Subject, Task, StudyBlock, ReviewItem, Material.
- Added owned subject/task creation and list queries, parameter binding, validation, indexes, and retryable initialization.
- Added a dashboard after login, connected to `user.id`.
- Moved the original mint accent direction to purple.

### Commitment scheduler

- Added deadline/date task queries, scheduled study blocks, joined task titles, and Today's Focus.
- Started with Schedule 30m and a block beginning immediately.
- Expanded to Schedule, a scheduling modal, duration/start selections, status display, Mark Done, missed detection, and rescheduling.
- Added `rescheduled_from` migration/indexing so missed sessions remain as history with a single direct replacement.
- Added an atomic database trigger to increment postponement counts once per replacement, including retry protection and count backfill.

### Flexible scheduling and coaching

- Replaced fixed duration buttons with a custom positive whole-number TextInput.
- Replaced limited start choices with Now or a local 24-hour HH:mm later today.
- Added a database-backed daily workload check above 240 planned/completed minutes, with explicit proceed/adjust actions.
- Split cross-midnight blocks across local dates and preserved DST-aware calendar boundaries.
- Added task coaching and a 5-minute action when postpone_count reaches 2.
- Extracted scheduling/entry sheets, common controls, formatting, and shared data loading from the monolithic app.

### Demo data

- Added a transactional reset scoped to the signed-in user and a Mock-only Load Demo Data action.
- Seeded three subjects, six tasks with varied deadlines and postponement examples, and exactly 240 study minutes today.
- Seeded elapsed blocks as done so the automatic missed check does not immediately reduce the workload demonstration total.
- The integration pass added three immediately due ReviewItems and verified repeated reloads, rollback, and account isolation.

### Tabs, theme system, and concrete styling

- Moved navigation to Expo Router, keeping the custom `index.js` entry for the URL polyfill.
- Added Home, Library, Review, and Settings route wrappers with screen implementations in `screens/`.
- Added SessionContext and a shared StudyWorkspace so actions/data refresh across tabs.
- Added ThemeContext: dark default with purple accents; monochrome light mode with black primary actions.
- Added Ionicons, a bordered bottom tab bar, 20px screen padding, 16px cards, visible input backgrounds, bold titles, and consistent spacing.
- Kept native appearance/status/navigation colors in sync with the selected theme.

### Review Queue

- Replaced the temporary Review tab of missed/postponed work with the actual subject-linked spaced-repetition queue.
- Added ReviewService.createReviewItem, getDueReviews, and markReviewed with account scoping and validation.
- New/null-timestamp topics are immediately due. Hard/Good/Easy set the next review to 1/3/7 local calendar days.
- Due-condition updates prevent repeat taps from rating the same occurrence twice.
- Added a topic form, due cards, rating buttons, background refresh, and confirmation of the next review time.
- Removed roundabout slogans across authentication, dashboard, settings, and sheets; retained functional guidance and coaching.
- Fixed the requested motto at the bottom of Settings: **By students, for students.**

### Final integration and error prevention

- Added CompletionReviewSheet after Mark Done: optional topic creation using the completed block's authoritative subject ID.
- Added `subject_id` consistently to StudyBlock service results.
- Preserved completion when a user skips the prompt or topic saving fails.
- Made the inline Review form keyboard-aware; existing auth and shared modal forms already used KeyboardAvoidingView.
- Rejected invalid duration edits as a whole and blocked Save until corrected, rather than stripping characters and changing their meaning.
- Added the requested empty-state messages for no study blocks and no due reviews.
- Removed a post-insert review lookup that could make an inserted topic appear unsaved after a read error; a failure-injection regression test covers retry behavior.
- Added a full production-SQL integration test for scheduling, completion, review creation, missed detection, rescheduling, and coaching counts.

### Data Backup (2026-10-21)

- Ran `npx.cmd expo install expo-file-system expo-sharing expo-document-picker`. Expo selected FileSystem `~57.0.7`, Sharing `~57.0.23`, DocumentPicker `~57.0.3`, and added its Sharing config plugin.
- Added `db/BackupService.js`: formatted versioned JSON, all five owned collections, native file/share APIs, and JSON picker cancellation.
- Validate structure, references, dates, reschedule chains/counts, and a 20 MB limit before replacing data. Restore remaps IDs to the current account in one exclusive transaction; rollback preserves prior data on failure.
- Preserve postponement counts by assigning imported history links after inserting blocks, avoiding the existing INSERT trigger.
- Added Settings' themed Data Management card, both requested buttons, the exact overwrite warning, loading/error states, and a note about file-path-only attachment metadata.
- Connected import refresh/reset and backup mutation locks through StudyWorkspace. Both adapters can back up study records.
- Added 22 backup tests and `npm run test:backup`; all 79 combined tests, lint, typecheck, dependency compatibility, and both native bundle exports pass.
- Updated the context/runbook/validation documents. [DATA_BACKUP.md](DATA_BACKUP.md#file-by-file-changelog) lists every file changed or created in this feature; no project files were deleted. Native picker/share interaction still requires a device check.

### Real Appwrite authentication diagnostics (2026-10-21)

- Found the active adapter flag was still false, so login/signup used in-memory Mock accounts independently of Appwrite. Enabled the real adapter for the requested investigation.
- Added exact `code`, `message`, and `type` console logs in signUp/signIn catch blocks. Both rethrow the original error to the existing UI. Signup now awaits automatic login so failures in that step are caught/logged too.
- Preserved email trim/lowercase normalization and name trimming. Validated nonempty config, normalized surrounding whitespace/trailing endpoint slashes, retained the Client endpoint/project/platform setters, and logged only public target configuration.
- Confirmed the platform matches app.json's Android/iOS identifiers. A read-only `/account` request with the configured project ID returned a guest `401 general_unauthorized_scope`; no credentials or account creation were sent. Dashboard project selection, native registration, and successful live login still require checking with the reported device error.
- Added five auth tests for normalization/client wiring, duplicate signup, login rejection, failure after registration, and invalid config. Lint/typecheck and all 84 combined tests pass. Updated mode/troubleshooting context in README, PROJECT_CONTEXT, DEMO_AND_TESTING, NEXT_SESSION_PROMPT, and validation evidence.

### Keyboard, spacing, time-window scheduler, and bookshelf (2026-10-22)

- Corrected shared sheet keyboard behavior with a full-modal KeyboardAvoidingView, shrinkable viewport, scrollable header, and focused-input scrolling based on actual window coordinates. Subject/Task, Schedule, and completion-to-review sheets inherit the fix.
- Increased card separation from 12px to 24px, internal card padding from 16px to 20px, and section/form/action spacing by roughly 8–12px. Kept existing typefaces, borders, icons, dark/light screen colors, and auth behavior.
- Removed the non-editable estimated-minute fallback from task cards. `estimated_minutes` stays in SQLite and backups for compatibility; postponed task counts still display.
- Replaced the duration/Now form with manually typed Start Time and End Time, explicit Today/Tomorrow choices, and strict local HH:mm validation. The existing SQLite service derives workload from elapsed instants, including midnight/DST. Its 240-minute warning and exactly-once rescheduling rules are unchanged.
- Added a responsive bookshelf of subject spines with binding details, stored colors, task counts, selection icons, and Show all reset. Stored book colors appear in both themes as a scoped exception to light-mode monochrome chrome. Long/scaled names contribute to spine height. Imported/reset data still clears stale filters.
- No dependency, schema, or authentication changes were needed.

File-by-file changes in this UX pass (no files deleted):

| File | Change |
| --- | --- |
| `components/ui.js` | Full-modal keyboard avoidance, shrinking/scrollable sheet content, focused-input measurements, and increased shared input spacing. |
| `components/EntrySheet.js` | Added spacing around subject/color choices and form actions. |
| `components/ScheduleSheet.js` | Editable start/end clock fields and day choices; preserved workload confirmation and original/coaching duration suggestions. |
| `components/SubjectBookshelf.js` | Created responsive selectable book-spine grid with contrasting ink, counts, readable titles, and all-subject reset. |
| `components/StudyCards.js` | Removed default estimate display; increased coaching spacing; changed recovery copy to start/end times. |
| `components/studyStyles.js` | Shared card/section/list/coaching spacing and padding increases. |
| `screens/HomeScreen.js` | Increased workload card and summary spacing. |
| `screens/LibraryScreen.js` | Integrated bookshelf/task filters, memoized subject counts, and roomier creation actions. |
| `utils/scheduling.js` | New time-window/default helper contract, strict clocks/days, future starts, explicit overnight behavior, DST-safe instants. |
| `tests/database.test.cjs` | Replaced old duration-input checks and added window/default/threshold/overnight/reschedule/DST coverage. |
| `README.md` | Updated Library/scheduler overview and current UX summary. |
| `docs/PROJECT_CONTEXT.md` | Updated service/helper contracts, current SDK version, keyboard strategy, spacing, and bookshelf theme exception. |
| `docs/DEMO_AND_TESTING.md` | Revised demo steps, manual keyboard/bookshelf/time checks, and combined test command. |
| `docs/NEXT_SESSION_PROMPT.md` | Updated continuation context and current UX contracts. |
| `docs/VALIDATION.md` | Added dated verification results and physical-device limitations. |
| `docs/CHANGELOG.md` | Recorded this implementation and full per-file summary. |

### Native calendar scheduling, info popups, and tactile books (2026-10-22)

- Installed `@react-native-community/datetimepicker` 9.1.0 with `npx.cmd expo install`; Expo updated the lockfile and added its config plugin.
- Replaced manual HH:mm and Today/Tomorrow controls with full native Start/End dates and times. Android uses native calendar/clock dialogs; iOS uses compact native pickers. Future dates have no two-day limit.
- Scheduler state now keeps actual Date values. Validation compares full timestamps: today at 5 PM is valid at 4 PM; tomorrow morning and next week are valid; only already-passed starts and invalid/end-at-or-before-start windows are blocked. Moving Start preserves session duration, and date/time picks preserve the other component. Workload-warning confirmation revalidates its original selected instants before writing.
- Added reusable FieldLabel/InfoButton guidance popups and moved general instructions out of auth/study forms, card headings, empty states, and Settings. Errors, workload totals/confirmation, the import overwrite warning, demo replacement notice, and decision prompts remain visible.
- Refined books with double binding lines, shaded grooves, lined paper edges, a themed recessed shelf/lip, and full wrapping titles. Subject filtering/counts and both themes remain connected to the existing data.
- Reworked scheduler regression tests for native full-date selections, today/tomorrow/next-week/year-boundary cases, clock/calendar edits, unchanged input dates, stale confirmation, DST instants, workload checks, overnight split, and exactly-once rescheduling. No SQLite schema/service or authentication behavior changes.

File-by-file changes (one new component, no files deleted):

| File | Change |
| --- | --- |
| `package.json` | Added SDK-compatible native date/time picker 9.1.0. |
| `package-lock.json` | Locked the picker and its dependency metadata. |
| `app.json` | Expo installation added the picker config plugin. |
| `components/DateTimeField.js` | Created reusable iOS/Android native date/time controls with cancellation/error handling and date bounds. |
| `components/ScheduleSheet.js` | Integrated native full-date state, duration-preserving edits, selected-date validation and confirmation revalidation; removed manual fields/toggles/helper paragraphs. |
| `utils/scheduling.js` | Full-Date window contract, timestamp validation, calendar/clock merging, and unrestricted future-date defaults. |
| `components/ui.js` | Added FieldLabel/InfoButton and native instructional alerts; Input accepts help while retaining keyboard behavior. |
| `components/EntrySheet.js` | Moved subject/task instructions into field-label info popups. |
| `components/StudyCards.js` | Moved heading/empty-state/recovery help into popups; retained short coaching guidance. |
| `components/studyStyles.js` | Added compact screen-title/info layout. |
| `components/SubjectBookshelf.js` | Added page/binding texture, cover shading, themed shelf, and unclipped long titles. |
| `screens/AuthScreen.js` | Replaced intro/card instructional paragraphs with info icons; login logic unchanged. |
| `screens/HomeScreen.js` | Moved workload explanation to an info icon; actual over-limit status remains visible. |
| `screens/LibraryScreen.js` | Replaced content/shelf/task helper paragraphs with title info icons. |
| `screens/ReviewScreen.js` | Added subject/topic/rating guidance popups and removed repeated inline guidance. |
| `screens/SettingsScreen.js` | Moved explanatory descriptions into info icons while retaining overwrite/replacement warnings and motto. |
| `tests/database.test.cjs` | Added full-date picker regressions and updated SQL integration tests for future selected days. |
| `README.md` | Updated native scheduler and compact-help/bookshelf overview. |
| `docs/PROJECT_CONTEXT.md` | Updated component map, Date-based helper contracts, native interaction, validation and popup rules. |
| `docs/DEMO_AND_TESTING.md` | Updated picker demo, device/rebuild guidance, future-date/cancel/popup/title acceptance checks. |
| `docs/NEXT_SESSION_PROMPT.md` | Updated continuation context with current native-picker/helper contracts and verification. |
| `docs/VALIDATION.md` | Added dated test/build/compatibility evidence and native interaction limits. |
| `docs/CHANGELOG.md` | Recorded this feature and updated the accepted scheduling decisions below. |

### Subject palette and Review UI tuning (2026-10-22)

- Expanded dark-mode subject creation to ten named vibrant colors. Light mode hides the color chooser and uses white books, gray outlines/page edges, and black text/icons. Stored subject colors are preserved; subjects created in light mode retain an Iris default for dark mode.
- Removed review interval captions, the interval guidance popup, and interval wording from accessibility labels. Rating feedback now says "Review saved." Database scheduling intervals and rating guards are unchanged.
- No dependencies, database logic, or files were added or deleted.

| File changed | Summary |
| --- | --- |
| `components/EntrySheet.js` | Ten dark-mode subject colors; hide the light-mode color chooser; stable stored default. |
| `components/SubjectBookshelf.js` | Theme-aware monochrome light-mode book faces, outlines, ink, and paper edges. |
| `screens/ReviewScreen.js` | Keep Hard/Good/Easy buttons; remove interval captions, popup, and accessibility reminders. |
| `components/StudyWorkspace.js` | Simplify successful rating feedback to "Review saved." |
| `screens/SettingsScreen.js` | Correct theme guidance to describe dark-only subject colors. |
| `docs/PROJECT_CONTEXT.md` | Update current palette, light-mode presentation, and Review UI contracts. |
| `docs/NEXT_SESSION_PROMPT.md` | Update continuation context for this tuning pass. |
| `docs/DEMO_AND_TESTING.md` | Update palette/theme and review-rating manual checks. |
| `docs/VALIDATION.md` | Record this pass's checks and device-verification limits. |
| `docs/CHANGELOG.md` | Record this feature and every changed file. |

### Fields of study, gradient shelves, and saved themes (2026-10-22)

- Installed AsyncStorage 2.2.0 and Expo LinearGradient ~57.0.2 with Expo's SDK-compatible installer.
- ThemeProvider restores `yotei.theme` before mounting screens, uses dark as a safe fallback, and saves toggles in order. Preferences are device-wide and independent of authentication or study-data import.
- Replaced Subject's `color` column with `field_of_study` and comma-separated `field_colors`. The initialization transaction preserves IDs, ownership, legacy colors, and all linked records, placing legacy subjects under General. No data reset is required.
- Add Subject now accepts Field of Study text and one/two distinct choices from ten color swatches. Both themes support explicit color selection; task/review selectors and markers remain monochrome in light mode.
- Library groups subjects by field into horizontal shelves. Both themes retain colored gradient spines, full titles on contrasting paper labels, binding/page lines, task counts, and selection/filtering. Removing the old flex sizing lets titles determine content height instead of being clipped. One-color fields get subtle shading; two-color fields blend their selected pair.
- Updated all subject-linked queries and demo seeds. Backup version 2 preserves field metadata; version-1 files still import with their original colors under General. Invalid fields/colors are rejected before replacing data.
- Verification: lint/typecheck, Expo dependency compatibility, Android/iOS exports, 95 passing combined tests (one timezone-specific skip), and 45 passing New York database tests. Physical-device shelf appearance/gestures and cold-launch appearance still need manual checking.

File-by-file changes (two new files, no files deleted):

| File | Change |
| --- | --- |
| `package.json` | Added SDK-compatible storage/gradient dependencies and `test:theme`. |
| `package-lock.json` | Locked the installed dependencies. |
| `ThemeContext.js` | Saved/restored preference, startup hydration, ordered writes, safe storage-failure handling, uniform monochrome light-mode markers. |
| `utils/subjectFields.js` | New shared field/color normalization, validation, first-color selection, and gradient shading helper. |
| `db/database.js` | New Subject columns/index and atomic legacy color migration without replacing IDs. |
| `db/SubjectService.js` | New field metadata contract and validated, owned inserts/reads. |
| `db/TaskService.js` | Read new Subject fields and derive the existing task marker color. |
| `db/StudyBlockService.js` | Derive study-block marker colors from field metadata in both joined queries. |
| `db/ReviewService.js` | Use field metadata for review subject lookups and marker colors. |
| `db/seedData.js` | Seed three fields with one/two-color examples; preserve existing demo workload/review counts. |
| `db/BackupService.js` | Version-2 export/import validation, field persistence, and backward-compatible version-1 conversion. |
| `components/EntrySheet.js` | Field text input, one/two-color swatches, validation, and updated task subject selector. |
| `components/SubjectBookshelf.js` | Field-grouped horizontal gradient shelves, natural-height spines, full readable paper labels and binding/page details in both themes. |
| `screens/LibraryScreen.js` | Updated bookshelf browsing/grouping guidance. |
| `screens/ReviewScreen.js` | Derive subject selector dots from the first field color. |
| `screens/SettingsScreen.js` | Explain saved themes and the bookshelf color exception. |
| `tests/database.test.cjs` | Field normalization/linked-service coverage, gradient checks, legacy migration/reopen/foreign-key preservation, and invalid metadata rejection. |
| `tests/backup.test.cjs` | Version-2 round trips, version-1 conversion, invalid field/color preservation, and updated export-version assertions. |
| `tests/theme.test.cjs` | New provider tests for hydration, defaults/read failures, ordered rapid toggles, remount restoration, and write-error recovery. |
| `README.md` | Updated Library, migration, theme persistence, and backup overview. |
| `docs/PROJECT_CONTEXT.md` | Updated schema, service contracts, persistence, and bookshelf/theme rules. |
| `docs/NEXT_SESSION_PROMPT.md` | Updated continuation context for fields, saved themes, and backup versions. |
| `docs/DATA_BACKUP.md` | Documented version-2 subject metadata and version-1 compatibility. |
| `docs/DEMO_AND_TESTING.md` | Added field creation, horizontal shelves, cold-start theme, migration, and theme-test checks. |
| `docs/VALIDATION.md` | Recorded this pass's checks and physical-device limits. |
| `docs/CHANGELOG.md` | Recorded implementation decisions and this complete file summary. |

### Subject editing and explicit task-filter reset (2026-10-22)

- Renamed Library's filter-reset button to **Show All Tasks** and updated its accessibility label/help text.
- Added a separate pencil action on every book. It opens the shared, keyboard-aware EntrySheet with the current name, field, and selected colors. Imported/legacy colors outside the standard palette remain visible and selectable. Save changes updates the row and refreshes the shared workspace; cancel does not write, and failures retain the draft.
- Added `updateSubject(userId, subjectId, {name, field_of_study, field_colors})` with validation, parameter binding, an ownership-scoped UPDATE, and explicit failure for missing/unowned IDs. Updates preserve subject IDs and all linked data; field edits regroup the shelf without clearing the task filter.
- Lint/typecheck and 46 database tests passed, with one timezone-specific skip. No dependencies, schema changes, new files, or deletions.

| File changed | Summary |
| --- | --- |
| `db/SubjectService.js` | Added validated, account-scoped in-place subject updates. |
| `components/EntrySheet.js` | Reused the form for pre-filled editing, retained legacy color choices, and added Save changes. |
| `components/SubjectBookshelf.js` | Renamed Show All Tasks and added accessible pencil buttons separate from book filtering. |
| `components/StudyWorkspace.js` | Added guarded edit-sheet state/actions, update confirmation, and shared refresh after save. |
| `screens/LibraryScreen.js` | Connected pencil actions and updated shelf guidance. |
| `tests/database.test.cjs` | Added linked-record preservation, metadata validation, SQL binding, and account-isolation update coverage. |
| `docs/PROJECT_CONTEXT.md` | Updated the service contract and subject-editing behavior. |
| `docs/NEXT_SESSION_PROMPT.md` | Added editing and reset-label continuation context. |
| `docs/DEMO_AND_TESTING.md` | Added device checks for prefill, save/cancel, shelf movement, and legacy colors. |
| `docs/VALIDATION.md` | Recorded this pass's checks and remaining native verification. |
| `docs/CHANGELOG.md` | Recorded this implementation and every changed file. |

### Subject deletion (2026-10-22)

- Added `deleteSubject(userId, subjectId)` with account/ID validation and a parameter-bound owned DELETE. Existing SQLite cascades remove linked tasks, study blocks (including replacement history), reviews, and materials atomically.
- Added a red `#FF4C4C` trash action labeled Delete Subject at the bottom of Edit Subject only. The native Alert uses the requested warning and Cancel/Delete actions. Confirmation and pending deletion guard against duplicate taps and competing saves; a failed deletion keeps the draft available for retry.
- Confirmed deletion closes the sheet, reports Subject deleted, and refreshes shared tab data. Library clears its selected subject filter when that subject no longer exists.
- Lint/typecheck passed. Database and confirmation-flow tests: 51 passed, 0 failed, one timezone-specific skip. No dependency or schema changes.

| File changed | Summary |
| --- | --- |
| `db/SubjectService.js` | Added owned subject deletion relying on atomic SQLite cascades. |
| `components/EntrySheet.js` | Added edit-only red delete action, native confirmation, save/delete locks, loading and error feedback. |
| `components/StudyWorkspace.js` | Close the sheet, show deletion confirmation, and refresh all shared lists after success. |
| `screens/LibraryScreen.js` | Clear the filter when its selected subject has been deleted. |
| `tests/database.test.cjs` | Added cascade/history/material/account isolation, invalid-ID rejection, and rollback coverage. |
| `tests/subject-deletion.test.cjs` | New actual-component confirmation tests for cancel/dismiss, success, duplicate taps, save exclusion, and failure/retry. |
| `docs/PROJECT_CONTEXT.md` | Updated delete API and UI/data behavior. |
| `docs/NEXT_SESSION_PROMPT.md` | Added deletion continuation context and test command. |
| `docs/DEMO_AND_TESTING.md` | Added device deletion checks and the new test suite to the combined command. |
| `docs/VALIDATION.md` | Recorded test evidence and remaining native checks. |
| `docs/CHANGELOG.md` | Recorded this implementation and every changed/created file. |

One test file created; no files deleted.

### Commitment Focus Timer (2026-10-22)

- Added StudyBlock `actual_start_time` and integer `break_time_minutes`, plus `break_started_at`, precise `break_time_ms`, `actual_end_time`, and `actual_study_seconds` to persist mode and final totals accurately. Existing rows migrate in place with null/zero defaults; no historical actual times are invented.
- Added account-scoped, transactional Start/Take Break/Resume/Finish services with retry guards and one active session per account. Work equals actual wall-clock duration minus all breaks; short breaks retain millisecond precision and studied seconds are floored once at completion. Finishing during a break closes it correctly.
- Home replaces active cards with a themed FocusTimer showing live work/current-break time, total breaks, and lateness. The old timed-window Mark Done button becomes Start Session; Finish Session stores done/actual totals and opens the existing CompletionReviewSheet. Done cards display saved actual totals.
- Active sessions remain accessible past midnight/scheduled end, are not auto-missed, and retain their planned contribution to the existing workload guardrail. Timer mode survives app restarts and continues while away; the view ticks only while focused and foreground, deriving elapsed time from persisted instants.
- Backups export version 3 with all timer fields and validated states/totals. Versions 1/2 remain importable with empty timer defaults. Active/open-break anchors and completed results survive restoration.
- Lint/typecheck, both native exports, 110 combined test cases (one additional timezone-specific skip), and all 54 New York database cases passed. Physical-device timer/modal/background behavior still needs manual checking. No dependencies were changed.

File-by-file changes (three new files, no files deleted):

| File | Change |
| --- | --- |
| `db/database.js` | Added six timer columns and retryable migrations with null/zero defaults. |
| `db/StudyBlockService.js` | Added start/pause/resume/finish transitions, timing persistence, ownership/retry/one-active guards, and active-session visibility across dates. |
| `db/StudyLoadService.js` | Included active sessions in planned daily workload. |
| `db/BackupService.js` | Added version-3 timer fields, state/arithmetic validation, and version-1/2 conversion defaults. |
| `utils/focusTimer.js` | New timestamp-derived work/break/lateness calculations and elapsed formatter. |
| `components/FocusTimer.js` | New themed live focus/break card with foreground ticking, lateness, total breaks, and timer controls. |
| `components/StudyCards.js` | Replaced Mark Done with Start Session and added actual completion totals. |
| `components/StudyWorkspace.js` | Connected timer mutations/loading/errors and Finish Session to the existing review prompt and shared refresh. |
| `screens/HomeScreen.js` | Rendered active timer cards first; clarified planning-workload guidance. |
| `tests/database.test.cjs` | Added lifecycle/precision/retry/ownership/rollback/restart tests; updated academic loop and migration checks. |
| `tests/backup.test.cjs` | Added timer round trips and invalid-state protection; updated version and legacy conversion assertions. |
| `tests/focus-timer.test.cjs` | New actual-component tests for live/break displays, lateness, actions, foreground catch-up and interval cleanup. |
| `README.md` | Updated timer flow, background behavior, backup versions and UI-test commands. |
| `docs/PROJECT_CONTEXT.md` | Updated architecture diagram, schema, service APIs, timer semantics, workload/review integration and backup contracts. |
| `docs/NEXT_SESSION_PROMPT.md` | Updated continuation context and latest verification. |
| `docs/DEMO_AND_TESTING.md` | Updated walkthrough and manual checks for timer actions, persistence and actual completion. |
| `docs/DATA_BACKUP.md` | Documented version-3 timer fields, invariants and older-format support. |
| `docs/VALIDATION.md` | Recorded regression/build results, bridge-test scope and physical-device limits. |
| `docs/CHANGELOG.md` | Recorded this implementation, current decisions and every changed/created file. |

### Swatches, appearance controls, Home motto, and web guard (2026-10-24)

- Enlarged named color circles, added a visible gray outline, and added pure Black/White to the twelve-color subject palette. Existing two-color selection and subject editing remain unchanged.
- Settings now labels the current Dark Mode/Light Mode. Its light-mode switch uses a black enabled track, gray disabled track, and white thumb. A web active-thumb override removes React Native Web's green default.
- Moved the requested small motto from Settings to the bottom of Home's list, including its empty state.
- App.js checks Platform.OS and shows a themed mobile-only notice on web before mounting authentication or study routes. A platform-specific database.web.js excludes the static SQLite/WASM import entirely; native storage continues using database.js with existing migrations.

File-by-file changes (two new files, no files deleted):

| File | Change |
| --- | --- |
| `components/EntrySheet.js` | Larger outlined color circles plus Black/White palette choices. |
| `screens/SettingsScreen.js` | Dynamic theme label, explicit monochrome switch colors/web thumb, and removal of motto/footer styles. |
| `screens/HomeScreen.js` | Added subtle motto as the final list footer. |
| `App.js` | Added themed browser notice and Platform.OS guard before sessions/routes mount. |
| `db/database.web.js` | New import-free web storage boundary; rejects unsupported database access without loading SQLite. |
| `tests/web-platform.test.cjs` | New regression tests for excluded native imports, browser notice, and preserved Android/iOS route mounting. |
| `README.md` | Updated screen overview, swatch palette, and browser/mobile boundary. |
| `docs/PROJECT_CONTEXT.md` | Updated palette, appearance controls, motto placement, and web boundary. |
| `docs/NEXT_SESSION_PROMPT.md` | Updated continuation context for this pass. |
| `docs/DEMO_AND_TESTING.md` | Added swatch/theme/motto/browser acceptance checks and web verification commands. |
| `docs/VALIDATION.md` | Recorded this pass's checks and manual verification limits. |
| `docs/CHANGELOG.md` | Recorded implementation and every changed/created file. |

### Task editing/deletion and future-session missed badge (2026-10-26)

- Added validated, parameter-bound `updateTask` and `deleteTask` scoped to the signed-in user. Updates preserve IDs, deadlines, estimates, status, postponement counts, and block history. Deletion cascades blocks; existing `ON DELETE SET NULL` preserves material notes under their subject. Subject-linked reviews remain unchanged.
- Task cards have themed Edit and red Delete icon/text actions. Edit reuses EntrySheet with prefilled title/subject, Save changes, draft retention on failure, and shared refresh. Delete requires native Cancel/Delete confirmation and guards duplicate taps, competing edits, and other workspace mutations; cancel/dismiss makes no writes.
- Task queries derive unresolved-miss existence and latest scheduled start across all dates. Library hides Missed Session if any scheduled block starts in the future, even next week and even when created independently of the old miss. Database history and Home missed cards remain; postponement coaching is unchanged. Derived flags are not stored or added to backups.
- Verification: lint/typecheck and all regression suites passed (121 passing cases, one timezone-specific skip). No dependencies or schema changes; physical-device interaction remains a manual check.

File-by-file changes (one new file, no files deleted):

| File | Change |
| --- | --- |
| `db/TaskService.js` | Added owned update/delete, safe title validation, and all-date missed/scheduled summary fields on task reads. |
| `components/EntrySheet.js` | Added prefilled task edit mode, owned update call, and Save changes. |
| `components/StudyWorkspace.js` | Added guarded task editor state, native delete confirmation/loading/error handling, and shared refresh/notifications. |
| `components/StudyCards.js` | Added accessible Edit/Delete actions and conditional Missed Session badge. |
| `components/studyStyles.js` | Added wrapping task-action layout and themed/destructive control styles. |
| `screens/LibraryScreen.js` | Used all-date task summaries and shared clock for badge visibility; updated task help. |
| `tests/database.test.cjs` | Added update/ownership/validation, cascade/rollback/material preservation, and all-date summaries; captured current derived summaries in persistence/isolation snapshots. |
| `tests/task-library.test.cjs` | New actual-component tests for editing, confirmation/retry/duplicate guards, card actions, and future-session badge suppression. |
| `tests/subject-deletion.test.cjs` | Extended the existing TaskService bridge with updateTask for the shared editor import. |
| `README.md` | Updated Library overview and task lifecycle/history behavior. |
| `docs/PROJECT_CONTEXT.md` | Added service contracts, delete semantics, and derived badge rules. |
| `docs/NEXT_SESSION_PROMPT.md` | Added task continuation context and corrected the palette count. |
| `docs/DEMO_AND_TESTING.md` | Added manual edit/delete/badge acceptance checks. |
| `docs/VALIDATION.md` | Recorded regression evidence and remaining native verification. |
| `docs/CHANGELOG.md` | Recorded this feature and every changed/created file. |

### Subject-code spines, animated front covers, and typed durations (2026-10-26)

- Added Subject.subject_code with a GEN-101 default and retryable transactional migration preserving existing IDs and relations. Codes normalize uppercase, allow 1–32 letters/numbers and common separators, and are editable in the shared form. Older update callers that omit the code retain it. Demo books have distinct MATH-2, BIO-101 and HIST-101 codes.
- Replaced full-name default books with narrow gradient spines showing only the code rotated 90 degrees. Tapping reveals a front cover via standard Animated width/tilt/lift; OS reduced motion snaps directly. The cover shows full name, code, task count, a separate pencil action and return control. Revealing never filters; tapping the cover body selects/deselects, with visible selection indicators. Show All Tasks resets filtering and closes the cover. Both themes keep colored gradients, binding/page details and wrapping cover titles.
- Added optional duration text beside the existing native date/time controls. 4h 30m, 45m, 2h, or bare whole minutes compute End from Start. Moving Start keeps length; editing End clears the shortcut. Invalid drafts cannot save prior dates, including keyboard submission. Elapsed-time calculations retain overnight/DST behavior, workload confirmation and exactly-once rescheduling.
- Backups now export version 4 with validated subject codes. Versions 1–3 remain importable with GEN-101 codes; version-3 timers are preserved, and only versions 1/2 receive empty timer defaults.
- Verification: lint/typecheck, 128 passing tests with one timezone skip, 61 passing New York database tests, and Android/iOS bundle exports. Native visual/motion checks remain manual. No dependencies added, no files created or deleted.

| File changed | Summary |
| --- | --- |
| `db/database.js` | Added subject_code to fresh schema and in-place transactional migration with GEN-101 defaults. |
| `db/SubjectService.js` | Added normalized code create/read/update support; omitted code retains its previous value on update. |
| `utils/subjectFields.js` | Added default code and shared code normalization/validation. |
| `components/EntrySheet.js` | Added prefilled, keyboard-aware subject-code input and code validation in subject save flow. |
| `db/BackupService.js` | Added version-4 code export/validation/import and version-1/2/3 conversion without resetting version-3 timers. |
| `db/seedData.js` | Added distinct demo subject codes. |
| `components/SubjectBookshelf.js` | Implemented vertical code-only spines, animated front covers, separate filter/edit/return actions, selected state, and reduced-motion support. |
| `screens/LibraryScreen.js` | Updated compact bookshelf interaction guidance. |
| `utils/scheduling.js` | Added strict duration parser and immutable elapsed-time duration-to-End helper. |
| `components/ScheduleSheet.js` | Added optional duration input, live End calculation, manual-End precedence and invalid-draft save protection; preserved pickers and workload/reschedule flow. |
| `tests/database.test.cjs` | Added code CRUD/ownership, migration defaults, parser/overflow/DST and duration-based workload coverage. |
| `tests/backup.test.cjs` | Updated export-version expectations and added code round trips/invalid-code preservation and version-3 timer compatibility checks. |
| `tests/task-library.test.cjs` | Extended the component hook/native bridges and added subject-code, spine/cover selection/edit, duration/precedence/validation/warning/reschedule tests. |
| `README.md` | Updated bookshelf, code migration, duration and version-4 backup overview. |
| `docs/PROJECT_CONTEXT.md` | Updated schema, API contracts, code normalization/migration, shelf interaction, duration rules and backup compatibility. |
| `docs/NEXT_SESSION_PROMPT.md` | Updated continuation context for codes, covers, typed durations and backup versions. |
| `docs/DATA_BACKUP.md` | Documented version-4 code field and version-1/2/3 compatibility. |
| `docs/DEMO_AND_TESTING.md` | Updated coded-book walkthrough, reveal/filter/edit steps, typed duration and migration/restore/device checks. |
| `docs/VALIDATION.md` | Recorded test/timezone/native-export evidence and physical-device limits. |
| `docs/CHANGELOG.md` | Recorded this implementation and every changed file. |

### Academic journal styling and Opened Book navigation (2026-10-26)

- Installed the requested Google fonts with Expo's compatible installer. App.js loads six local Merriweather/Inter faces before mounting screens; explicit face names avoid synthetic font-weight differences. Titles are serif, body/buttons/inputs are Inter, borders are softer, and cards have subtle shadows. Exact requested cream/forest and dark/sage palettes replace the old purple/monochrome chrome, with saved theme choice retained.
- Library is now bookshelf-only. Spines still reveal covers; a cover opens a dedicated subject notebook through a nested Expo Router Library stack. Removed Show All Tasks and the inline task list. The ruled-paper notebook shows subject name/code, scoped task rows, New Task preselected to the book, and Edit/Delete Book controls. Invalid/unowned/missing books return to Library; shared workspace/data/sheets remain above tabs.
- Subject creation/editing refreshes silently. Existing errors, major backup feedback and destructive-action confirmations remain. Direct book deletion uses the same guarded native confirmation/mutation flow as task deletion, preserving SQLite cascades and shared refresh.
- Home uses serif headings and green progress bars. Existing custom durations, workload guardrails, focus timers, review loop, account isolation and backup format remain unchanged.
- Checks: lint/typecheck, dependency compatibility, 133 passing tests (one timezone skip), and Android/iOS/web exports. Physical-device typography, transitions, navigation gestures and native sheets still need manual verification.

File-by-file changelog (five created files, one deleted route wrapper):

| File | Change |
| --- | --- |
| `App.js` | Load six bundled font faces before screens; use journal typography for the web notice. |
| `ThemeContext.js` | Apply exact cream/forest and dark/sage palettes while preserving saved theme behavior. |
| `components/typography.js` | Created: centralized Merriweather/Inter face names and soft card shadows. |
| `components/studyStyles.js` | Serif screen/card titles, Inter body/actions, soft shadows, and flat notebook task-row styling. |
| `components/ui.js` | Journal fonts for sheets/buttons/inputs and a themed destructive button tone; keyboard behavior retained. |
| `components/StudyWorkspace.js` | Suppress Subject create/edit success notices; share guarded native task/book deletion and refresh. |
| `components/StudyCards.js` | Add notebook task-card variant while retaining schedule/edit/delete/coaching/badge behavior. |
| `components/SubjectBookshelf.js` | Open dedicated notebooks from covers; remove task-filter/reset/selected controls; use serif book titles. |
| `components/EntrySheet.js` | Use Inter in field-color/delete controls; shared subject/task save behavior retained. |
| `components/ScheduleSheet.js` | Use Merriweather titles and Inter instructional/workload text; scheduling behavior retained. |
| `components/DateTimeField.js` | Use Inter for native date/time control labels and values. |
| `components/FocusTimer.js` | Use Inter for timer/body labels; shared card title becomes serif. |
| `screens/AuthScreen.js` | Apply serif headings/card title, Inter inputs/actions/body, and soft card shadow. |
| `screens/HomeScreen.js` | Apply journal fonts/shadow, serif study-time heading, and green progress bars. |
| `screens/LibraryScreen.js` | Replace task/filter list with bookshelf-only scrolling content, Add Subject and book-route navigation. |
| `screens/OpenedBookScreen.js` | Created: subject-scoped notepad page with header/code/tasks, New Task, Edit/Delete Book and safe redirect/back behavior. |
| `screens/ReviewScreen.js` | Apply Inter to review metadata alongside the shared serif card/title styles. |
| `screens/SettingsScreen.js` | Apply journal typography, green switch colors and updated appearance guidance/preview labels. |
| `src/app/(tabs)/_layout.tsx` | Use Inter in tab labels; existing Library tab hosts its nested stack. |
| `src/app/(tabs)/library.tsx` | Deleted: replaced the flat Library wrapper with the nested Library route directory. |
| `src/app/(tabs)/library/_layout.tsx` | Created: themed native Library stack with shelf and subject routes. |
| `src/app/(tabs)/library/index.tsx` | Created: shelf screen wrapper preserving /library. |
| `src/app/(tabs)/library/[subjectId].tsx` | Created: dynamic Opened Book screen wrapper. |
| `package.json` | Add Merriweather and Inter Google font packages; retain SDK-compatible expo-font. |
| `package-lock.json` | Lock the two installed font packages and metadata. |
| `tests/task-library.test.cjs` | Cover shelf-only navigation, book-scoped tasks/actions/redirects, quiet Subject saves, backup feedback and book-delete guards. |
| `tests/web-platform.test.cjs` | Verify font-load gating/fallback and preserved web/native roots with local face imports. |
| `tests/theme.test.cjs` | Update neutral light-mode subject marker expectation for the journal palette. |
| `tests/focus-timer.test.cjs` | Load the actual typography constants in the native UI bridge harness. |
| `tests/subject-deletion.test.cjs` | Load the actual typography constants for the shared editor bridge tests. |
| `README.md` | Update journal typography/palettes and bookshelf-to-notebook overview. |
| `docs/PROJECT_CONTEXT.md` | Update route/provider map, theme/font contracts, notebook ownership/deletion behavior and quiet-save feedback. |
| `docs/NEXT_SESSION_PROMPT.md` | Refresh continuation context for journal styling, nested Library routes and dedicated task notebooks. |
| `docs/DEMO_AND_TESTING.md` | Update walkthrough and manual font/theme/book/task/delete/back-navigation checks. |
| `docs/VALIDATION.md` | Record installation, tests, dependency compatibility, native/web exports and device verification limits. |
| `docs/CHANGELOG.md` | Record final implementation and every changed/created/deleted file. |

### Light fallback, strict type scale, reversible books and smart shelf adds (2026-10-27)

- Theme now falls back to Light for missing, invalid or unreadable preferences; explicit saved Dark and ordered theme writes remain intact. Dark books derive desaturated gradients blended with the theme background and use dark labels/light ink/page details, without altering stored field colors.
- All active screen, sheet, input, button and tab text uses one named scale: H1 28, H2 22, H3 18, body/button 14, small 12. Live timer/workload numerals use a single 36-point metric token. Matching line-height tokens replace local values; Merriweather/Inter and OS text scaling remain.
- Both book faces stay mounted through the full forward/reverse transition. Close and switching books animate width, measured height, lift, tilt and crossfade back to the spine. Interrupted transitions stop/reverse the same value; hidden controls cannot receive touches or accessibility focus. Reduced motion snaps directly.
- Each shelf has an accessible + action opening Add Subject with its field prefilled. The editor offers a filtered, case-insensitively deduplicated existing-field dropdown with show-all toggle, while allowing brand-new text. Presets reset between entry flows; failed saves retain drafts.
- Verification: lint/typecheck, 138 passing regressions with one timezone skip, and Android/iOS/web exports. No dependency/schema changes or file creation/deletion in this pass. Prior uncommitted journal work was preserved. Physical-device rendering, gestures and keyboard selection still need manual checks.

File-by-file summary for this pass:

| File changed | Summary |
| --- | --- |
| `ThemeContext.js` | Default missing/invalid/unreadable preferences to Light, preserve saved Dark, and add theme-aware book paper/ink/page/rule colors. |
| `components/typography.js` | Define the shared heading/body/small/button/metric size and line-height scale. |
| `components/studyStyles.js` | Apply semantic type tokens to shared cards/headings/body/actions and allow long masthead captions to wrap. |
| `components/ui.js` | Apply the shared scale to sheet titles, labels, buttons, inputs and feedback. |
| `components/SubjectBookshelf.js` | Mute Dark gradients, retain both animated faces through Close/reversal, measure cover height, hide inactive controls, and add each shelf field-prefill + action. |
| `utils/subjectFields.js` | Add presentation-only dark book tinting and normalized, case-insensitive existing-field collection. |
| `components/EntrySheet.js` | Add initialField creation prefill and searchable/show-all existing-field dropdown with custom values; use shared text tokens. |
| `components/StudyWorkspace.js` | Carry/reset the optional shelf field through guarded entry state into the shared editor. |
| `screens/LibraryScreen.js` | Wire shelf + to Add Subject with its field prefilled. |
| `components/CompletionReviewSheet.js` | Bring completion-to-review subject/title/prompt into the shared fonts and scale. |
| `components/DateTimeField.js` | Use shared body size/leading for picker control values. |
| `components/FocusTimer.js` | Use shared labels and the single 36-point metric size for elapsed time. |
| `components/ScheduleSheet.js` | Use semantic heading/body/small tokens for the task and workload form. |
| `screens/AuthScreen.js` | Use consistent H1/H2/body/small/button sizes and leading throughout authentication. |
| `screens/HomeScreen.js` | Use shared headings, small metadata and 36-point workload numerals. |
| `screens/ReviewScreen.js` | Use the shared small-text token for review metadata. |
| `screens/SettingsScreen.js` | Use shared title/body/small tokens for account and settings cards. |
| `screens/OpenedBookScreen.js` | Use shared heading/body/small/button tokens in the subject notepad. |
| `src/app/(tabs)/_layout.tsx` | Use the shared small size/leading for tab labels. |
| `App.js` | Use semantic heading/body tokens for the browser notice. |
| `tests/theme.test.cjs` | Verify Light fallback, preserved explicit Dark, ordered toggles and write-failure recovery. |
| `tests/task-library.test.cjs` | Verify retained/reversible/interruptible cover animation, reduced motion, Dark tint invariants, shelf prefill/reset and existing/custom field save/retry flows. |
| `tests/subject-deletion.test.cjs` | Extend the shared editor test bridge with its memo hook. |
| `README.md` | Update fallback, type scale, Dark book appearance, Close and field autocomplete overview. |
| `docs/PROJECT_CONTEXT.md` | Document theme defaults, type tokens, animated face lifetime/measurement and shelf-prefill/dropdown contracts. |
| `docs/NEXT_SESSION_PROMPT.md` | Update continuation context for Light fallback, muted books, reverse motion, strict scale and field picker behavior. |
| `docs/DEMO_AND_TESTING.md` | Add native acceptance checks for defaults, sizes, keyboard/dropdown selection, Dark contrast and both animation directions. |
| `docs/VALIDATION.md` | Record current regression/lint/type/bundle evidence and remaining physical-device limits. |
| `docs/CHANGELOG.md` | Record this pass and every file changed during it. |

### Weekly Progress and six-day demo history (2026-10-27)

- Installed `react-native-svg` 15.15.4 and `react-native-chart-kit` 7.0.4 with Expo's SDK-compatible installer.
- Added Home's Weekly Progress card before Today's Focus: seven local dates, a responsive forest-green/soft-green LineChart, cream/dark plot background, quiet axes, zero-minute dates and point inspection. The card uses existing serif headings, Inter labels, borders, shadows and theme tokens.
- Added one account-scoped SQL aggregation for completed work. Timer sessions contribute saved actual studied seconds, preserving true zero-work sessions and excluding breaks. Untimed legacy completions contribute scheduled duration. Each session counts on its local completion date, with exact midnight and DST-safe boundaries. Planned/active/missed sessions do not inflate completed progress; the daily workload guardrail continues to use planned minutes separately.
- Connected progress to the shared refresh flow, so completion, deletion, demo/import, foreground, refresh and local-date rollover update it with the existing lists.
- Demo loading now creates ten blocks: today's existing four-hour fixture plus one completed session on each of the previous six days (60, 90, 75, 120, 105 and 150 minutes, oldest first). Existing three subjects, six tasks, coaching examples, due reviews and account-scoped transactional replacement are preserved.
- Verification: lint/typecheck, dependency check and Android/iOS/web exports passed. Eight suites: 144 cases, 143 passed and one NY-specific skip; New York database run: all 64 passed. Native chart appearance and gestures remain device checks. No schema/backup-format changes and no files deleted.

File-by-file changes for this feature (two new files):

| File | Change |
| --- | --- |
| `package.json` | Added SDK-compatible SVG and Chart Kit dependencies. |
| `package-lock.json` | Recorded the installed chart dependencies and resolved dependency tree. |
| `db/ProgressService.js` | New validated, account-scoped seven-day completed-minute query with zero-filled local dates and actual/legacy timing rules. |
| `components/WeeklyProgressCard.js` | New responsive themed LineChart card, totals, point readout, accessible seven-day summary and loading/error feedback. |
| `hooks/useDashboardData.js` | Fetch and expose weekly results alongside existing data under the same request/refresh guards. |
| `screens/HomeScreen.js` | Render Weekly Progress above Today's Focus using shared account data. |
| `db/seedData.js` | Insert six previous completed timer sessions in the existing reset transaction; return ten total blocks while preserving today's 240-minute fixture. |
| `components/StudyWorkspace.js` | Update demo-load confirmation to describe the six historical study dates. |
| `screens/SettingsScreen.js` | Update demo info-popup text to include completed history. |
| `tests/database.test.cjs` | Exercise the progress service with real SQLite; extend timer/seed tests for actual totals, isolation, local boundaries, DST and unchanged workload warnings. |
| `tests/task-library.test.cjs` | Add chart/Home component checks for values, zeros, layout, point inspection, themes, loading/errors and placement; extend native/chart test bridges. |
| `README.md` | Describe Weekly Progress and the expanded demo fixture. |
| `docs/PROJECT_CONTEXT.md` | Document new modules/service contract, completed-minute attribution, refresh integration and demo counts. |
| `docs/NEXT_SESSION_PROMPT.md` | Add continuation context for the chart dependencies, metric, fixtures and validation. |
| `docs/DEMO_AND_TESTING.md` | Add chart walkthrough/acceptance steps, ten-block counts and the full eight-suite command. |
| `docs/VALIDATION.md` | Record SQL/component/timezone checks, dependency/bundle results and remaining native checks. |
| `docs/CHANGELOG.md` | Record this feature's decisions and complete file-by-file summary. |

### Global success toasts, Title Case and themed info dialogs (2026-10-27)

- Replaced duplicated inline success cards with one theme-aware Toast above the actual BottomTabBar. It slides/fades in, expires after three seconds even while hidden, and cannot block screen/tab touches. Repeated identical messages receive a fresh notice identity/lifetime. Settings hides and discards all shared success messages, including backup/demo messages, preventing replay on another tab. Keyboard/sheet/busy states hide the toast; errors remain inline.
- Replaced InfoButton's native instructional Alert with InfoModal: themed surface/border/overlay, Merriweather heading, Inter body/buttons, scrollable long guidance and backdrop/close/OK/Android Back dismissal. Existing destructive confirmation alerts are preserved.
- Applied Title Case to static screen/card headings, field/action labels, session badges, auth controls and notebook actions. User-entered names/topics, explanatory sentences, error/success sentences and the wordmark retain their casing.
- Verification: lint/typecheck and final Android/iOS/web exports pass. Nine regression suites: 151 cases, 150 passed and one existing timezone skip. New notification tests cover expiry, replacement, Settings isolation, hidden-state behavior, cleanup and themed dialogs. No dependency, schema or storage-service changes; four new files, no files deleted.

File-by-file summary for this pass:

| File | Change |
| --- | --- |
| `components/Toast.js` | New nonblocking, themed slide/fade toast with three-second expiry and timer/animation cleanup. |
| `components/ToastTabBar.js` | New single tab-bar host; discard Settings notices and hide while keyboard/sheets/busy states are active. |
| `components/InfoModal.js` | New themed, scrollable Merriweather/Inter information dialog with all dismissal paths. |
| `components/ui.js` | Open local InfoModal instances from InfoButton instead of native instructional alerts. |
| `components/StudyWorkspace.js` | Add fresh notice identities and stable dismissal while retaining existing success/error producers. |
| `src/app/(tabs)/_layout.tsx` | Attach the toast host through the navigator's custom tabBar property. |
| `components/StudyCards.js` | Remove inline success cards; retain error/retry feedback and standardize card/action/status labels. |
| `components/studyStyles.js` | Remove obsolete inline success-card/dismiss styles. |
| `components/EntrySheet.js` | Title Case subject/task sheet headings, field labels, kicker and save/create actions. |
| `components/ScheduleSheet.js` | Title Case schedule/reschedule headings, duration label and workload-confirmation actions. |
| `components/CompletionReviewSheet.js` | Title Case completion heading, kicker and choice actions. |
| `components/FocusTimer.js` | Title Case break/work status and total-break label. |
| `components/SubjectBookshelf.js` | Standardize the shelf Add Subject action's accessible label. |
| `components/WeeklyProgressCard.js` | Title Case the chart's static minute caption. |
| `screens/AuthScreen.js` | Title Case authentication headings, form labels, tabs, Remember Me and demo action. |
| `screens/HomeScreen.js` | Title Case daily-workload/coaching headings and session-planning action. |
| `screens/LibraryScreen.js` | Title Case shelf edition, empty heading and Add Subject. |
| `screens/OpenedBookScreen.js` | Title Case New Task/Edit Book/Delete Book actions and empty heading. |
| `screens/ReviewScreen.js` | Title Case topic heading, subject action, edition and unreviewed status label. |
| `screens/SettingsScreen.js` | Title Case account/appearance, preview, demo-data and Sign Out headings. |
| `App.js` | Title Case the browser's mobile-only heading. |
| `tests/notifications.test.cjs` | New controlled-clock/native-bridge tests for Toast, tab-bar isolation, InfoButton and InfoModal. |
| `tests/task-library.test.cjs` | Add inline-feedback/notice-identity checks and update interaction labels to Title Case. |
| `tests/subject-deletion.test.cjs` | Update editor field/save label selectors to Title Case. |
| `tests/web-platform.test.cjs` | Update expected mobile-only heading. |
| `README.md` | Describe themed info dialogs, global toast expiry and Settings suppression. |
| `docs/PROJECT_CONTEXT.md` | Document new component roles, feedback ownership, casing and dialog behavior. |
| `docs/NEXT_SESSION_PROMPT.md` | Add toast/dialog continuation contracts and SDK-compatible tab-bar imports. |
| `docs/DEMO_AND_TESTING.md` | Add toast, Settings, casing and dialog acceptance checks plus the new test suite. |
| `docs/VALIDATION.md` | Record regression/bundle evidence and remaining physical-device checks. |
| `docs/CHANGELOG.md` | Record implementation decisions and this complete 31-file summary. |

### Reflection Pivot, Study Materials, Task Descriptions, and Interactive Progress (2026-10-27)

- Completed presentation/UI and notebook data work first, followed by chart interaction and the reflection pivot. The auth card now says Welcome Back. Settings always offers the account-scoped demo reset, including with Appwrite. Fresh theme fallback remains Light; stored choices still restore. Both book themes use identical vibrant field gradients, with light text/code on dark paper labels. Existing three-second global toast, Settings discard, Title Case and themed information dialogs remain integrated.
- Added nullable Task.description with in-place migration, owned validated service writes, multiline create/edit and notebook display. Omitted updates preserve old descriptions; explicit empty input clears them.
- Added owned MaterialService and notebook Study Materials with Title/URL-or-path forms, recoverable OS opening errors, edit and confirmed deletion. Absolute Windows/device paths and HTTP(S)/file/content references normalize for Linking.openURL. No uploads, copied file contents or original-file deletion.
- Chart points open themed daily details with completed task titles, allocated session, actual work/break/elapsed totals and scheduled-end overrun. The background opens weekly total, seven-date daily average and best day, with date links into details. Point/background dispatch is separated. Details query account-scoped completed sessions using the chart's local completion-day/DST boundaries; untimed historical completions retain their scheduled-duration fallback. There is no invented separate break allocation.
- Replaced spaced repetition with ReflectionItem(id, subject_id, study_block_id nullable, note, created_at). Existing review topics/IDs/subjects migrate atomically into notes; old schedules are retired. A failed migration leaves old records/schema intact and retries safely. Session links detach when their block is deleted; subject deletion cascades notes.
- Finish Session persists completion before the optional Reflect on This Session note sheet. Skip or failed note saving never undoes completion; failure retains the draft. Reflections replaces Review in the tab bar and route tree, with a journal icon, standalone notes and subject-grouped newest-first entries.
- Backup version 5 includes descriptions and reflection session links. Versions 1-4 still import, converting topics into notes with last-reviewed/export timestamps and null descriptions. ID remapping, timer/history validation, 20 MB bounds and owned transaction rollback remain intact. Demo now includes described tasks, three linked reflections and three material URLs alongside the unchanged four-hour/two-coaching/six-historical-day fixtures.
- Verification: lint/typecheck, SDK dependency check, Android/iOS/web exports, 155 passing regression cases with one existing timezone skip, and all 61 New York database cases. No dependencies were added. Device appearance, gestures, file access and live Appwrite remain manual checks.

Complete per-file summary for this overhaul (nine files created, four retired):

| File | Change |
| --- | --- |
| `db/database.js` | Add Task.description and migrate legacy ReviewItem into the five-column ReflectionItem table atomically, preserving IDs/data and required cascades/indexes. |
| `db/TaskService.js` | Create/read/update optional validated descriptions; preserve omitted values; update reflection terminology. |
| `db/MaterialService.js` | **Created:** validated account-scoped material create/list/edit/delete. |
| `utils/materialLinks.js` | **Created:** supported URL/file-location validation and absolute-path-to-URI conversion. |
| `components/MaterialSheet.js` | **Created:** keyboard-aware Title/URL-or-path editor with loading and draft-preserving errors. |
| `components/StudyMaterials.js` | **Created:** notebook references, OS linking, recoverable errors, edit and delete actions. |
| `components/EntrySheet.js` | Add prefilled multiline Task Description and reflection terminology in help/confirmation copy. |
| `components/StudyCards.js` | Display descriptions in notebook tasks and update subject/reflection guidance. |
| `screens/OpenedBookScreen.js` | Attach the subject-scoped Study Materials section below tasks. |
| `screens/AuthScreen.js` | Replace Credentials with Welcome Back and update journal guidance. |
| `screens/SettingsScreen.js` | Show functional Load Demo Data for both adapters, retain replacement warning and describe new demo fixtures. |
| `components/SubjectBookshelf.js` | Restore identical vibrant field gradients in both themes while retaining themed book ink/details. |
| `components/InfoModal.js` | Support optional rich children for progress-detail dialogs while preserving standard guidance messages. |
| `db/ProgressService.js` | Add owned completed-day session detail query and allocation/study/break/elapsed/overrun metrics. |
| `components/ProgressDetailsModal.js` | **Created:** themed weekly aggregate and lazy-loaded daily task/session details, errors and accessible date actions. |
| `components/WeeklyProgressCard.js` | Separate point/background taps, open detail/summary modals and prevent point taps from being replaced by background actions. |
| `screens/HomeScreen.js` | Pass the signed-in account ID into interactive chart details. |
| `db/ReflectionService.js` | **Created:** owned note creation/chronological reads, optional completed-session validation and composed insert result. |
| `components/CompletionReflectionSheet.js` | **Created:** quick multiline post-session note, save/skip and draft/error handling. |
| `screens/ReflectionsScreen.js` | **Created:** keyboard-aware standalone note form and subject-grouped chronological journal. |
| `src/app/(tabs)/reflections.tsx` | **Created:** active Reflections route wrapper. |
| `src/app/(tabs)/_layout.tsx` | Replace Review tab with Reflections and journal icons. |
| `components/StudyWorkspace.js` | Wire reflection/material flows and locks, preserve global success/error behavior, enable both-adapter demo resets and update backup/demo feedback. |
| `hooks/useDashboardData.js` | Share reflection/material lists with existing refresh guards and progress data. |
| `components/studyStyles.js` | Add theme/font-consistent reflection note styling. |
| `db/BackupService.js` | Version-5 descriptions/reflections, legacy conversion, linked-session validation and owned ID remapping/restoration. |
| `db/seedData.js` | Seed task descriptions, linked reflection notes and material references; retain today's 240 minutes and six historical completions. |
| `db/ReviewService.js` | **Deleted:** retired rating/due-date service, replaced by ReflectionService. |
| `components/CompletionReviewSheet.js` | **Deleted:** retired review-topic choice sheet, replaced by CompletionReflectionSheet. |
| `screens/ReviewScreen.js` | **Deleted:** retired spaced-repetition UI, replaced by ReflectionsScreen. |
| `src/app/(tabs)/review.tsx` | **Deleted:** retired tab route, replaced by reflections.tsx. |
| `tests/database.test.cjs` | Add description/material/reflection/day-detail/migration-rollback coverage; replace obsolete rating tests and update seed/cascade fixtures. |
| `tests/backup.test.cjs` | Exercise version-5 fields/links, old-version conversions, invalid data preservation and updated table snapshots. |
| `tests/task-library.test.cjs` | Test descriptions, materials, OS link errors, confirmations, chart dispatch/details, reflection flow/journal and real-auth demo access. |
| `tests/notifications.test.cjs` | Use current Reflection saved copy and Reflections route in toast isolation checks. |
| `tests/subject-deletion.test.cjs` | Update expected destructive-warning text for reflections. |
| `README.md` | Update feature overview, demo access, materials, interactive chart and reflection/backup behavior. |
| `docs/PROJECT_CONTEXT.md` | Update current schema, services, routes, migration, ownership and UI/business contracts. |
| `docs/NEXT_SESSION_PROMPT.md` | Rewrite copyable continuation context around the implemented reflection/material engine. |
| `docs/DEMO_AND_TESTING.md` | Rewrite presentation walkthrough, acceptance checks, current test commands and troubleshooting. |
| `docs/DATA_BACKUP.md` | Document version-5 JSON and versions 1-4 conversion, linked IDs, materials and current Settings feedback. |
| `docs/VALIDATION.md` | Record current regression/timezone/bundle evidence and native verification limits. |
| `docs/CHANGELOG.md` | Record implementation decisions and this complete file-by-file summary. |

### Light Startup, Kebab Actions, Permanent Files, Journal, and Quarter-Long Demo (2026-10-27)

- Fixed the reversed appearance switch: OFF now means Light and ON means Dark. Startup is explicitly cream/Light in ThemeContext, App.js and app config. Hydration ignores legacy plain strings from the old switch UI; only corrected version-2 JSON preferences restore an explicit Dark choice. New toggles still persist in order. Removed general Settings info icons while retaining complex guidance elsewhere.
- Replaced inline task/material Edit/Delete buttons with one top-right kebab. Themed Edit/Delete/Cancel options preserve destructive confirmations and owned service calls. iOS waits for modal dismissal before opening another editor/alert; Android hands off after commit. Chart dots grow to 7px and gain transparent 44px touch targets without changing point-vs-background behavior.
- Rechecked expo-document-picker with Expo's SDK installer. Browse File Manager is MaterialSheet's primary action; selected files copy from temporary/provider storage into private permanent documents storage. Saved rows persist local_file_path; manual URL/path entry remains secondary. Cancellation/replacement/unmount cleans up only unsaved new copies, not provider originals or committed files. JSON backups retain file URIs, not file bytes.
- Added owned JournalEntry(id,user_id,title,content,created_at), JournalService and a New Entry sheet. Journal replaces Reflections in the route/tab UI with one newest-first timeline combining manual entries and focus-session reflections. Namespaced IDs prevent cross-table key collisions; manual entries survive subject deletion. Focus reflection behavior remains intact, and shared refresh/toast/mutation guards connect both entry types.
- Backup version 6 includes manual entries. Versions 1-5 still import with an empty manual collection; existing descriptions, reflection/session links and timer/history conversion remain. Restore binds ownership to the destination and preserves transactional rollback.
- Demo data now spans three calendar months, clamped at month ends and generated by local dates. It includes 3 subjects, 18 described tasks, 12 materials, over 100 completed sessions with over/underruns/breaks/lateness, reflection notes and manual entries. Older rest days mix with a populated recent week. Today's 240 planned minutes remain; its first completion uses real elapsed time up to now. Counts vary with the calendar. Duration overruns compare elapsed time against allocation; late clock finishes are reported separately.
- Verification: lint/typecheck, dependency check, 166 passing regression cases with one existing timezone skip, all 64 New York database cases, and Android/iOS/web bundle exports. Device appearance, gestures, picker/file access and native handler permissions remain manual checks. A pre-existing AuthScreen local edit was preserved.

File-by-file summary for this pass (seven new files, two replaced routes/screens):

| File | Change |
| --- | --- |
| `ThemeContext.js` | Start Light, validate version-2 saved choices, ignore old reversed-switch values, and support a startup fallback during hydration. |
| `App.js` | Render cream StartupScreen with dark status text during font/theme hydration. |
| `app.json` | Set native startup appearance to Light. |
| `screens/SettingsScreen.js` | Correct switch value to isDark, remove redundant help icons, and describe the three-month demo. |
| `components/ItemActionsMenu.js` | **Created:** themed kebab options with safe platform-specific edit/delete handoff. |
| `components/StudyCards.js` | Replace inline task actions with kebab and allow simple headers without info icons. |
| `components/StudyMaterials.js` | Replace inline material actions with kebab controls. |
| `components/studyStyles.js` | Remove obsolete inline task-action styles. |
| `components/WeeklyProgressCard.js` | Larger visible dots and transparent 44px point targets that retain day/background isolation. |
| `utils/materialFiles.js` | **Created:** system picker, account-scoped permanent copy, partial-copy rollback and pending-copy cleanup. |
| `components/MaterialSheet.js` | Primary file picker, title autofill, permanent-file metadata, secondary manual input and draft/copy lifecycle guards. |
| `db/MaterialService.js` | Persist copied-file URIs in local_file_path with existing ownership/validation rules. |
| `db/database.js` | Add JournalEntry and owned chronological index without replacing existing records. |
| `db/JournalService.js` | **Created:** validated manual-entry creation/reads and owned combined chronological SQL feed. |
| `components/JournalEntrySheet.js` | **Created:** keyboard-aware Title/Content editor with validation and draft-preserving errors. |
| `screens/JournalScreen.js` | **Created:** virtualized manual-entry/reflection timeline and New Entry action. |
| `src/app/(tabs)/journal.tsx` | **Created:** active Journal route. |
| `src/app/(tabs)/_layout.tsx` | Rename the tab to Journal and retain journal icons. |
| `screens/ReflectionsScreen.js` | **Deleted:** replaced by the combined Journal screen; stored reflections remain. |
| `src/app/(tabs)/reflections.tsx` | **Deleted:** replaced by journal.tsx. |
| `hooks/useDashboardData.js` | Fetch the combined Journal feed through existing shared refresh/stale-request guards. |
| `components/StudyWorkspace.js` | Add journal sheet/save locks, refresh/toast feedback and updated backup/demo summaries. |
| `db/BackupService.js` | Version-6 manual-entry validation/export/import/counts, older-version defaults and awaited file lifecycle operations. |
| `db/ProgressService.js` | Separate duration overruns from scheduled-end clock lateness. |
| `components/ProgressDetailsModal.js` | Highlight Scheduled/Actual/Overrun comparisons and report late finishes separately. |
| `db/seedData.js` | Generate three calendar months of realistic sessions, reflections, manual entries, tasks and materials in one owned reset. |
| `tests/material-files.test.cjs` | **Created:** actual helper tests for persistent copies, cache independence, cancel/failure and scoped cleanup. |
| `tests/database.test.cjs` | Journal ownership/feed/keys, stored file URI, six-table/quarter-seed and overrun/workload/date regression checks. |
| `tests/backup.test.cjs` | Version-6 manual-entry round trips, file URIs, older imports and invalid-data preservation. |
| `tests/task-library.test.cjs` | Menus on iOS/Android, larger targets, Settings switch/help, file-picker lifecycle and manual Journal interactions. |
| `tests/theme.test.cjs` | Legacy preference reset, version-2 choice persistence, hydration and write recovery. |
| `tests/web-platform.test.cjs` | Assert Light startup fallback and preserve web/native route mounting checks. |
| `README.md` | Update theme, compact actions, files, Journal, backup and long-term demo overview. |
| `docs/PROJECT_CONTEXT.md` | Update schema, services, hydration, file lifecycle, Journal, metrics and demo contracts. |
| `docs/NEXT_SESSION_PROMPT.md` | Rewrite continuation context for the current Journal/file/theme implementation. |
| `docs/DEMO_AND_TESTING.md` | Update presentation and manual acceptance flows plus ten-suite commands. |
| `docs/DATA_BACKUP.md` | Document version-6 Journal collection, legacy defaults and permanent-file URI/byte boundary. |
| `docs/VALIDATION.md` | Record regression/timezone/bundle evidence and physical-device limits. |
| `docs/CHANGELOG.md` | Record this implementation and complete per-file summary. |

## Superseded decisions

| Earlier state/request | Current accepted implementation |
| --- | --- |
| Root registerRootComponent(App) bootstrap | Polyfill first, then expo-router/entry; App.js is reached through src/app/_layout.tsx |
| Single App.js dashboard | Shared workspace, separate screens, four bottom tabs |
| Mint / purple / monochrome chrome | Cream and forest-green light journal; greenish-black and sage dark journal |
| Schedule 30m | Schedule opens native Start/End calendar and time pickers |
| 15/30/45/60 buttons | Duration is calculated from the selected start/end instants |
| Now / In 1 hour only | Native full-date selection; service retains its no-options 1-hour reschedule default |
| Temporary Review recovery screen | Real due-topic spaced-repetition queue; missed blocks remain in Home |
| Editorial/marketing slogans | Functional app copy plus the explicitly requested Home motto |
| User-entered duration and Now/custom start form | Native full-date Start/End controls plus optional typed hours/minutes that calculate End |
| Typed clocks with Today/Tomorrow toggles | Native calendar/time pickers for any upcoming date |
| Long inline instructional paragraphs | Small info icons with native guidance popups; errors/warnings stay visible |
| Inline task list and Show All Tasks | Bookshelf-only Library; covers open subject-scoped notepad routes with task and book actions |
| Non-editable estimated minutes on task cards | Removed from UI; SQLite/backup field retained |
| Monochrome books / hidden light-mode color chooser | Colored gradient books in both themes; explicit one/two-color field swatches; monochrome light chrome and task/review markers |
| Subject.color | Subject.field_of_study and comma-separated field_colors; legacy colors preserved under General |
| Theme preference only in memory / dark fallback | AsyncStorage restoration and ordered saves; Light fallback with explicit Dark retained |
| Mark Done directly from a scheduled card | Start Session, durable work/break timer, Finish Session with actual totals and optional review prompt |
| Backup versions 1–3 | Version 4 adds subject_code; older versions still import with code defaults and compatible timer metadata |

## Git checkpoints present at handoff

These are actual repository commit subjects, not a claim that each subject alone describes every change in that commit.

| Commit | Subject |
| --- | --- |
| `9ecd6f2` | Initial commit |
| `6979faf` | Slice 2 complete: SQLite database and editorial dashboard |
| `652d885` | Real Appwrite auth working with SQLite |
| `34f1a4e` | Slice 3: Commitment Scheduler and Today's Focus working |
| `ed9f6c9` | Slice 3: Commitment Scheduler and Remember Login |
| `40752a9` | Expanded scheduler working |
| `2d14f76` | Phase 2: UI Overhaul, flexible scheduler, and coaching guardrails |
| `1c60135` | Demo data seeding working |
| `1f474ee` | Card styles and icons applied |
| `df860c2` | All core features implemented: Scheduler, Review Queue, Themes |
| `edfb6ab` | Fallback: Working state before fixing Expo Router entry point |

## Original source-handoff additions

The original handoff added README/context/history/runbook/validation documents, a copyable next-session prompt, and a repeatable source/history export script without changing runtime behavior. The subsequent Data Backup feature above adds runtime behavior. The pre-existing, untracked root `app/index.tsx` is preserved in the source snapshot.
