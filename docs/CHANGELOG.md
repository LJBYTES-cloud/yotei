# Implementation history and decisions

This consolidates the feature requests and reworks through the 2026-10-21 handoff. The current implementation and [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) take precedence over earlier intermediate designs.

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

## Superseded decisions

| Earlier state/request | Current accepted implementation |
| --- | --- |
| Root registerRootComponent(App) bootstrap | Polyfill first, then expo-router/entry; App.js is reached through src/app/_layout.tsx |
| Single App.js dashboard | Shared workspace, separate screens, four bottom tabs |
| Mint accent | Dark purple accents and monochrome light mode |
| Schedule 30m | Schedule opens a custom-duration sheet |
| 15/30/45/60 buttons | User-entered whole minutes |
| Now / In 1 hour only | UI supports Now / custom local HH:mm; service still has a no-options 1-hour reschedule default |
| Temporary Review recovery screen | Real due-topic spaced-repetition queue; missed blocks remain in Home |
| Editorial/marketing slogans | Functional app copy plus the explicitly requested Settings motto |
| User-entered duration and Now/custom start form | Typed Start Time/End Time with explicit Today/Tomorrow choices; background workload calculation |
| Horizontal subject pills in Library | Selectable book-spine grid; pill selectors remain in forms |
| Non-editable estimated minutes on task cards | Removed from UI; SQLite/backup field retained |
| Uniformly monochrome subject presentation in light mode | Colorful bookshelf spines in both themes; surrounding light chrome remains monochrome |

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
