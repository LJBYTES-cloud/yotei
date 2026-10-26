# Yotei project context

Current architecture updated: **2026-10-27, Asia/Singapore**. Original handoff snapshot: 2026-10-21. Source baseline: Git commit `edfb6ab` (`Fallback: Working state before fixing Expo Router entry point`). Read this file with [AGENTS.md](../AGENTS.md); inspect current code and `git status` before making changes.

## Purpose and implemented scope

Yotei is a mobile study planner. Its implemented academic loop is:

```mermaid
flowchart LR
  Subject --> Task --> Schedule --> FocusTimer
  FocusTimer --> Break --> FocusTimer
  FocusTimer --> Done --> ReflectionPrompt --> ReflectionItem
  Schedule --> Missed --> Reschedule --> PostponeCount --> Coaching
  Subject --> MaterialLink
  Done --> WeeklyProgress
```

All study data remains in local SQLite. Appwrite is an authentication adapter; it does not currently synchronize subjects, tasks, study blocks, or reflection notes.

## Stack and package policy

- Expo `~57.0.31`, React Native `0.86.3`, React `19.2.3`.
- JavaScript implementation with JSDoc types and `checkJs`; thin Expo Router routes use TSX.
- npm and `package-lock.json`; no Bun lockfile at this snapshot.
- Expo Router supplies the root stack and JavaScript bottom tabs. Ionicons come from `@expo/vector-icons`.
- Native modules used include SQLite, SecureStore, FileSystem, Sharing, DocumentPicker, safe-area context, screens, system UI, and fonts. Router animation peers are pinned to SDK-compatible versions.
- Install or change dependencies with `npx expo install`, as specified in AGENTS.md.
- The development target is the native app. Browser support is not validated end to end.

## Routing and bootstrap

1. `package.json` retains `"main": "index.js"`.
2. `index.js` imports `react-native-url-polyfill/auto` first and then `expo-router/entry`.
3. `src/app/_layout.tsx` re-exports `App.js`.
4. `App.js` loads six local Merriweather/Inter font faces with expo-font before mounting SafeAreaProvider, ThemeProvider, SessionProvider, themed navigation and the protected root Stack. Font errors permit system fallback rather than blocking authentication.
5. Signed-out/restoring users see `src/app/sign-in.tsx` -> `screens/AuthScreen.js`.
6. Signed-in users see `src/app/(tabs)/_layout.tsx`, with a shared StudyWorkspace above Home, Library, Reflections, and Settings (reflections.tsx).
7. Most tab routes re-export screens/. Library is a nested Stack under src/app/(tabs)/library/: index.tsx renders the shelf, [subjectId].tsx renders OpenedBookScreen. The former library.tsx wrapper was replaced; the shared workspace still wraps both views.

The original non-Router bootstrap used `registerRootComponent(App)`. That was superseded by the Router migration. Do not restore it while Router supplies the app entry.

### Additional root `app/` directory

At the start of this handoff, `app/index.tsx` was an untracked user file containing a Hello World screen. It is separate from the implemented app. The current export explicitly reports **Using src/app as the root directory for Expo Router**. Existing `tsconfig.json` includes `src/**/*.tsx`, but not the root `app/**/*.tsx` experiment.

The handoff preserves that file. If investigating a startup problem, verify the working directory, the entry chain, and Metro's selected root before moving/deleting routes or changing the architecture. A successful bundle verifies compilation, not a live navigation session on the phone.

References: [Expo custom entry setup](https://docs.expo.dev/router/installation/), [top-level src directory](https://docs.expo.dev/router/reference/src-directory/), [SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/).

## File map

| Location | Responsibility |
| --- | --- |
| `App.js` | Bundled font loading, root providers, themed navigation, protected auth stack and web notice |
| `ThemeContext.js` | Shared palettes, AsyncStorage theme restoration/serialized saves, subject-color presentation, native appearance |
| `auth/AuthService.js` | Adapter interface and once-per-cold-boot remember-me gate |
| `auth/MockAuthService.js` | In-memory users, built-in demo account, SecureStore public session |
| `auth/AppwriteAuthService.js` | Appwrite email/password authentication and normalized users |
| `auth/index.js` | Active adapter switch and shared singleton |
| `auth/SessionContext.js` | Session restoration, sign-in acceptance, sign-out state |
| `components/StudyWorkspace.js` | Shared data/actions, mutation locks, scheduling and completion prompts |
| `hooks/useDashboardData.js` | Owned data loading, missed-block updates, reflections/materials, weekly progress, stale-request protection |
| `components/ui.js` | Themed controls, FieldLabel/InfoButton themed instructional dialogs, and keyboard-aware Sheet |
| `components/InfoModal.js` | Themed, scrollable information dialog with Merriweather/Inter fonts and native-back/backdrop dismissal |
| `components/Toast.js` | Native-driver slide/fade success toast with three-second expiry |
| `components/ToastTabBar.js` | Single toast host anchored to the Expo Router tab bar; discards Settings notices and hides for keyboards/sheets |
| `components/studyStyles.js` | Shared screen/card/typography styles |
| `components/StudyCards.js` | Screen header, task/focus/coaching cards, feedback and empty states |
| `components/ScheduleSheet.js` | Selected full start/end dates, workload confirmation, schedule/reschedule calls |
| `components/DateTimeField.js` | iOS compact native pickers and Android native calendar/clock dialogs |
| `components/SubjectBookshelf.js` | Field-grouped coded spines, animated covers, edit actions and dedicated notebook opening |
| `components/EntrySheet.js` | Subject and task forms |
| `components/WeeklyProgressCard.js` | Responsive, themed seven-day LineChart with point inspection and accessible totals |
| `db/ProgressService.js` | Account-scoped completed minutes grouped by seven local completion dates, including zeros |
| `components/FocusTimer.js` | Active work/break timer, lateness, foreground ticking, pause/resume/finish actions |
| `components/StudyMaterials.js` / `MaterialSheet.js` | Notebook reference list/opening and keyboard-aware owned editor |
| `components/ProgressDetailsModal.js` | Weekly aggregate and lazy-loaded owned daily session details |
| `screens/ReflectionsScreen.js` | Subject-grouped chronological note journal and standalone note form |
| `utils/focusTimer.js` | Timestamp-derived work/break/lateness calculations and elapsed formatting |
| `components/CompletionReflectionSheet.js` | Optional quick reflection after a completed focus session |
| `components/theme.js` | Time and minute formatting helpers; palettes now live in ThemeContext |
| `db/` | SQLite schema, services, workload/date helpers, demo seed |
| `db/BackupService.js` | Versioned JSON export, native file picker/share sheet, validated transactional account restore |
| `utils/scheduling.js` | Full-date window validation, native calendar/clock edits, and default suggestions |
| `tests/database.test.cjs` | Production service SQL exercised against real Node SQLite |
| `tests/auth.test.cjs` | Both adapters exercised with isolated storage/SDK substitutes |
| `tests/backup.test.cjs` | Real SQLite restore, ID mapping, account isolation, validation, rollback, native transport substitutes |

## Authentication contract

Both adapters return exactly the public user shape `{ id: string, name: string, email: string }`. UI and database services use `user.id`, not Appwrite's raw `$id`.

```javascript
signUp({ name, email, password, rememberMe = false })
signIn({ email, password, rememberMe = false })
signOut()
getCurrentUser()
```

- `USE_REAL_AUTH` is currently `true` for real Appwrite login diagnostics. Set it to `false` and fully reload for Mock auth; the demo loader is available with either adapter; those accounts are independent of Appwrite.
- Demo credentials: `student@yotei.demo` / `study12345`; stable demo user ID: `demo-student`.
- Mock passwords/accounts are in memory. SecureStore stores the public mock session and a provider-specific remember-me flag.
- Remember me defaults to false. A session remains usable during that launch; a false/missing/invalid flag causes cleanup on the next cold boot.
- A true flag permits session restoration. Sign-out disarms remembering and clears the provider session.
- Startup cleanup runs once per adapter instance and shares concurrent initialization calls. Failures block restoration and remain retryable.
- New mock credentials disappear on restart. A remembered public session can restore without reconstructing the mock password map; after signing out, a custom mock account may need to be created again. The built-in demo credentials remain available.
- Appwrite setup is lazy so Mock mode does not contact Appwrite. `appwriteConfig.js` now contains populated public client configuration; this differs from the initial placeholder request. No server API key belongs in that file.
- Real Appwrite behavior is covered by adapter tests with an SDK substitute; live backend/platform configuration is not revalidated by this handoff.
- The real adapter trims/normalizes email in both auth methods and validates/cleans the configured endpoint/project/platform before initializing one lazy Client. It logs the public target configuration and exact failure `{code, message, type}` for signIn/signUp, then rethrows the original error to the UI. Registration awaits its automatic login so a later login failure is also logged. Passwords/session payloads are not logged.
- A read-only request to the configured Singapore `/v1/account` endpoint using the configured project ID returned `401 general_unauthorized_scope` for a guest on 2026-10-21. This verifies API reachability and that the request reached the guest account permission check; it does not verify a user's credentials, dashboard project selection, or native platform registration.

## SQLite schema and ownership

Database: `yotei.db`. Initialization enables WAL and foreign keys, creates indexes, and exposes one shared connection only after initialization finishes. Failed initialization can retry.

| Table | Columns |
| --- | --- |
| Subject | `id`, `user_id`, `name`, `subject_code`, `field_of_study`, `field_colors` |
| Task | `id`, `user_id`, `subject_id`, `title`, `description`, `deadline`, `estimated_minutes`, `status`, `postpone_count` |
| StudyBlock | `id`, `task_id`, `start_time`, `end_time`, `status`, `rescheduled_from`, `actual_start_time`, `break_time_minutes`, `break_started_at`, `break_time_ms`, `actual_end_time`, `actual_study_seconds` |
| ReflectionItem | `id`, `subject_id`, `study_block_id` (nullable), `note`, `created_at` |
| Material | `id`, `subject_id`, nullable `task_id`, `title`, `url_or_note`, `local_file_path` |

IDs are SQLite integer IDs; authentication IDs are strings. Subject and Task have explicit `user_id` columns. Blocks inherit ownership through Task; ReflectionItem and Material inherit it through Subject. Services scope reads and writes to the signed-in account with bound SQL values.

```mermaid
erDiagram
  Subject ||--o{ Task : contains
  Subject ||--o{ ReflectionItem : contains
  Subject ||--o{ Material : contains
  Task ||--o{ StudyBlock : schedules
  Task o|--o{ Material : references
  StudyBlock o|--o| StudyBlock : replacement
```

- Task uses the composite `(subject_id, user_id)` foreign key to prevent linking another user's subject.
- Subject deletion cascades through its related tables; Task deletion cascades blocks and clears Material.task_id.
- Task cards offer Edit and Delete. `updateTask` validates the account, task ID, title and owned target subject, then changes title/subject_id and optional description using a bound owned UPDATE. IDs, deadlines, estimated_minutes, status, postpone_count, and linked blocks are preserved. Block titles/subject labels follow the edited task; existing subject-level reflection notes/materials keep their subject. `deleteTask` uses one owned DELETE, cascades all block history, and leaves materials as subject notes with task_id null. Native Cancel/Delete confirmation prevents duplicate submissions and competing actions; failure unlocks retry, success refreshes all tabs.
- `deleteSubject` validates the account and integer ID and executes one owned DELETE. Foreign keys atomically remove its tasks, blocks (including replacement history), reflection notes and materials. Missing/unowned IDs reject; a cascade failure rolls back the statement. The edit sheet offers a red Delete Subject action with native Cancel/Delete confirmation. Confirmation locks competing save/delete actions; success closes the sheet and refreshes shared tab data. Opened Book redirects to Library when its owned subject no longer exists; cancel/dismiss preserves the draft, and failure leaves the editor available to retry.
- `rescheduled_from` references the original block; a unique partial index permits one direct replacement for each original.
- Initialization adds `rescheduled_from` for older databases, converts legacy `planned` status to `scheduled`, installs the postponement trigger, and backfills counts without reducing existing demo/coaching values.
- Subject migration adds the two field columns, copies legacy `color` into `field_colors`, assigns existing subjects to `General`, then drops `color` in the initialization transaction. IDs, ownership and dependent records are preserved. A `(user_id, field_of_study, id)` index supports field access.
- Subject-code migration adds a non-null TEXT column with default GEN-101 in the retryable schema transaction, preserving IDs/dependencies. Codes normalize to uppercase, allow 1?32 letters/numbers plus spaces, dots, slashes, underscores and hyphens, and need not be unique. Omitted codes default on creation; older update callers preserve the existing code. Add/Edit Subject prefills the code; demo subjects use MATH-2, BIO-101 and HIST-101.
- MaterialService provides owned create/list/update/delete. MaterialSheet accepts Title and URL / File Path; StudyMaterials renders notebook references and calls Linking.openURL. Destructive confirmation deletes only the stored reference. HTTP(S), file/content URIs, www links and absolute Windows/device paths are supported; relative paths/unsupported schemes are rejected. No uploads or copied file contents; device access/handler failures are shown in the notebook. Task descriptions are nullable, trimmed, limited to 4,000 characters and preserved when omitted from updateTask; the multiline editor can clear them explicitly.

## Service entry points

| Module | Public functions / values |
| --- | --- |
| SubjectService | `createSubject(userId, {name, subject_code?, field_of_study?, field_colors?})`, `updateSubject(userId, subjectId, {name, subject_code?, field_of_study, field_colors})`, `deleteSubject(userId, subjectId)`, `getSubjectsForUser(userId)` |
| TaskService | `createTask(userId, {subject_id, title, description?, deadline?, estimated_minutes?})`, `updateTask(userId, taskId, {title, subject_id, description?})`, `deleteTask(userId, taskId)`, `getTasksForUser(userId, {date?, hasDeadline?})`, `getTasksWithDeadlines`, `getTasksForDate` |
| StudyBlockService | `createStudyBlock`, `getStudyBlocksForUser`, `getMissedBlocksForUser`, `markExpiredStudyBlocks`, `updateStudyBlockStatus`, `rescheduleStudyBlock`, `startStudyBlock`, `pauseStudyBlock`, `resumeStudyBlock`, `finishStudyBlock` |
| StudyLoadService | `DAILY_STUDY_LIMIT = 240`, `StudyLoadWarning`, `getDailyStudyMinutes`, `checkStudyLoad` |
| ProgressService | `getWeeklyStudyMinutes(userId, endDate = getLocalDateKey())`, `getStudyDayDetails(userId, date)` |
| ReflectionService | `createReflectionItem(userId, {subject_id, study_block_id?, note})`, `getReflectionsForUser(userId)` |
| MaterialService | `createMaterial(userId, subjectId, {title, location})`, `getMaterialsForUser`, `updateMaterial`, `deleteMaterial` |
| seedData | `seedDemoData(userId)` |
| dateUtils | `getLocalDateKey`, `getLocalDayRange` |
| utils/scheduling | `buildStudyTimes({start: Date, end: Date}, now)`, `getInitialStudyWindow(now, initialDuration)`, `updateStudyWindow(window, field, part, pickedDate)` |

Subjects and tasks support create/read/update/delete; other services expose their feature-specific creation/query/status operations.

Task list queries also return `has_missed_session` (an unresolved missed block exists) and `latest_scheduled_start` (the latest scheduled start across all dates). Opened Book shows Missed Session only when the former is true and the latter is not later than the shared clock. Summaries come from owned SQLite task queries rather than Home's day-filtered block array, so next-week scheduling hides the badge too. Missed history, Home recovery cards, and postponement coaching remain unchanged. The summary fields are derived rather than stored or backed up.

## Scheduling, workload, and recommitment

- The scheduling sheet uses `@react-native-community/datetimepicker` 9.1.0 for full Start/End dates and times. Android uses imperative native calendar/clock dialogs; iOS uses compact native controls. There is no Today/Tomorrow toggle or upper calendar-date restriction. Optional Duration input accepts 4h 30m / 45m / 2h or bare whole minutes. parseStudyDuration returns positive whole minutes; applyStudyDuration adds elapsed minutes to Start without mutating the source. Invalid drafts retain the prior dates and block Save, including keyboard submission. Changing Start preserves duration; manually editing End clears the shortcut. Clearing Duration retains the selected End. Overnight/DST windows and frozen workload confirmations keep the existing rules. SQLite derives elapsed minutes from the saved instants.
- The initial window begins at the next whole minute and uses the existing suggested length (normally 30 minutes, 5 minutes for coaching, or the missed block's length). Both endpoints are editable; this is distinct from the task's non-editable `estimated_minutes` field, which is no longer displayed on task cards.
- State stores actual Date objects, not relative day strings. A start is rejected only when its selected timestamp is earlier than now; the end must be later than the start. At 4 PM today, 5 PM today is valid; 8 AM tomorrow and next-week dates are valid too. Display strings are never parsed back as dates, and keeping the sheet open across midnight does not move its selected dates.
- Native clock edits preserve the selected calendar; native calendar edits preserve local hours/minutes and reject nonexistent local times. Moving Start shifts End by the currently selected duration. Editing End is independent. Native repeated-hour instants keep their original UTC offset. Workload confirmation revalidates its frozen instants against now before writing, so an expired start cannot be saved after waiting in the warning view.
- Store instants as ISO timestamps; calendar/date-only task deadlines remain date keys where appropriate.
- Task date queries can include tasks due on a date or with a block overlapping that local date.
- Workload includes planned minutes for `scheduled`, `active`, and `done` blocks; missed history is excluded. Cross-midnight blocks contribute only their overlap with each local day. Actual focused time is stored separately and does not replace this planning guardrail.
- A proposed total strictly greater than 240 minutes raises StudyLoadWarning. Exactly 240 is permitted. The user may explicitly confirm the warning; no block is inserted before confirmation.
- Scheduling writes are serialized so simultaneous submissions cannot both check an outdated workload total.
- Expired blocks with status `scheduled` are changed to `missed` on data refresh. Workspace checks every 30 seconds and on foreground activation, subject to mutation/modal locks; this is not an OS background notification service.
- Older unresolved misses remain visible so they can be rescheduled after midnight.
- Rescheduling preserves the missed record and creates a replacement with `rescheduled_from = original.id`. Repeated submissions return the existing replacement.
- The database trigger `count_study_block_postponement` increments Task.postpone_count on replacement insertion. **Do not add a second increment in the UI or service.** A retry must not increase the count again.
- The service's no-options reschedule default is one hour from the supplied reference time. The current UI supplies the user's selected start/end instants instead.
- The shared data refresh after saving exposes the new task count immediately. Coaching appears when `postpone_count >= 2`, with an action to schedule 5 minutes.

## Commitment Focus Timer

- A scheduled block displays Start Session during its scheduled window. `startStudyBlock(userId, blockId)` stamps actual_start_time and changes status to `active`. Future/expired/missed/resolved blocks cannot start; reschedule a miss first. At most one active block is allowed per account, including while on break. Different accounts remain isolated.
- An active block replaces the normal card with FocusTimer, sorted first in Home. It shows work elapsed, lateness (including starts less than one minute late), total breaks, and Take Break/Finish Session. During a break it shows current break elapsed, frozen work time, Resume Work, and Finish Session.
- `break_started_at` identifies an open break while status remains active. `break_time_ms` preserves exact completed break durations; `break_time_minutes` is their floored whole-minute projection, updated on resume/finish. `actual_end_time` and `actual_study_seconds` freeze the result on finish. Required fields and auxiliary timing fields migrate in place with null/zero defaults; historical done blocks receive no invented actual study time.
- Finish closes an open break, subtracts all break milliseconds from actual wall-clock duration, floors once to whole studied seconds, and marks done. Scheduled start/end times remain unchanged. Completed timer cards show actual studied time and break minutes.
- Start/pause/resume/finish serialize with scheduling writes and use exclusive transactions. Retrying a transition does not restart the clock or add a break twice. Ownership, state and backwards-clock checks run before committing; failure leaves stored timing intact. No fallible read follows a committed transition.
- Work/break timing derives from stored timestamps, not tick counts. The view ticks once per second only while Home is focused and the app is active, then catches up on foreground. Backgrounding, changing tabs, signing out or restarting does not implicitly pause: the selected work/break mode continues until changed. This does not require background JS or an OS timer service.
- Active blocks are excluded from automatic missed detection and remain in Home's date-filtered query even after midnight or the scheduled end, so users can resume/finish them. Expired unstarted scheduled blocks still become missed normally.

## Completion-to-Reflection Flow

1. Finish Session persists actual timing and done status before opening CompletionReflectionSheet.
2. The sheet says "Reflect on this session." and accepts a 1-4,000-character note. Saving uses the returned block's authoritative subject_id and id. Skip/close leaves the completed session intact; a failure retains the draft for retry.
3. ReflectionService resolves the owned subject and optional owned completed session before inserting, then returns a composed object without a fallible post-insert lookup. Standalone notes have a null session link. Subject deletion cascades notes; task/block deletion sets study_block_id to null, preserving the journal.
4. ReflectionsScreen uses a keyboard-aware SectionList grouped by subject, with newest notes first within each group. It includes a standalone note form. There are no due dates, rating buttons or review intervals.

Legacy migration creates ReflectionItem with exactly id, subject_id, study_block_id, note, created_at, copies old ReviewItem topics/IDs/subjects, then drops ReviewItem in the same retryable initialization transaction. Legacy notes use last_reviewed_at or the migration timestamp as created_at. Their future review schedules are intentionally retired. Task.description is added without replacing IDs or linked records. A migration failure rolls back the entire schema/data conversion.

## Weekly progress

- Home renders Weekly Progress above Today's Focus. `react-native-chart-kit` 7.0.4's root `LineChart` uses SDK-compatible `react-native-svg` 15.15.4, a measured card width, the shared type scale, forest-green/soft-green accents, cream/dark plot backgrounds, and no grid lines. Point selection opens a themed ProgressDetailsModal with completed task sessions, allocation/work/break/elapsed/overrun totals; background taps open weekly total/average/best-day summary with accessible day rows; an accessibility label contains all seven totals. Empty accounts render a real zero-valued series.
- `getWeeklyStudyMinutes(userId, endDate)` returns seven ascending `{date, minutes}` objects ending on the selected local date. A parameter-bound SQLite query joins ownership through Task and includes only `done` blocks. Dates use local calendar boundaries from dateUtils, so DST days need not be 24 hours.
- Timed completions use `actual_study_seconds / 60`, including genuine zero-work sessions. Untimed legacy completions use scheduled elapsed duration. Credit goes to `actual_end_time`, falling back to `end_time`. An overnight completion is credited entirely to its local completion day; individual historical break segments are not available for accurate day splitting. Scheduled, active and missed blocks are excluded. This completed-work metric is separate from the daily planned-workload guardrail.
- `useDashboardData` refreshes weekly results alongside the other lists, preserving its stale-request guard. Completion, deletion, demo reset, import, foreground refresh, pull-to-refresh and local-date rollover therefore update the chart through the existing shared refresh flow. No schema or backup-format changes were needed.

## Demo seed

`seedDemoData(userId)` uses an exclusive transaction to clear that user's Material, ReflectionItem, StudyBlock, Task, and Subject records and replace them with:

- Mathematics, Biology, History.
- Six tasks: tomorrow/today/overdue deadlines; two tasks have postpone_count 2 so coaching is visible.
- Four 60-minute study blocks with 10-minute gaps, all inside today's local calendar day. Their total study duration is exactly 240 minutes, including near midnight and DST days.
- Elapsed seeded sessions are `done`; current/future ones are `scheduled`. This prevents the automatic missed check from reducing the intended demonstration workload immediately after loading.
- Six additional completed timer sessions, one per previous local date: 60, 90, 75, 120, 105 and 150 minutes, oldest to newest. Stored actual timestamps/seconds populate Weekly Progress immediately; these ten total blocks do not change today's four-hour workload.
- Three reflection notes linked to completed historical blocks, plus one material reference link per subject. Tasks include editable descriptions.

The seed returns `{ subjects: 3, tasks: 6, studyBlocks: 10, reflectionItems: 3, totalMinutes: 240 }`. It preserves authentication and other accounts' records; rollback restores prior study records if an insert fails.

## Study data export/import

Settings > Data Management uses BackupService version 5 for all five collections: subjects, tasks, studyBlocks, reflectionItems and materials. Task descriptions and optional reflection session links are included. Versions 1-4 import; legacy reflection notes become reflection notes, created_at uses last_reviewed_at or exported_at, and descriptions default to null. Prior subject-code/field/timer conversions remain intact. IDs and session/history references are remapped to the signed-in account in one exclusive transaction, preserving other accounts and rolling back failures. Import validates before deletion, including completed-session links, timer arithmetic, reschedule chains and the 20 MB limit. See DATA_BACKUP.md for the full contract.

## UI constraints that remain in force

- Keep functional text; the early marketing/editorial slogans were removed. Static screen/card headings, form labels, badges and action buttons use Title Case. Preserve user-entered names/topics, explanatory sentences, validation errors, success sentences and the lowercase wordmark.
- Home displays **By students, for students.** in a small, subtle footer after the study list or empty state. Settings has no motto footer.
- Retain the four Ionicons tabs, subtle tab top border, cards, visible input backgrounds/borders, and full-width primary actions.
- Shared screen horizontal padding is 20px. Standard cards use 20px internal padding, 16px radius, a 1px border, and 24px separation. Section/action/form spacing increased by roughly 8–12px in the UX pass.
- Dark journal palette: background #121412, surface #1C201D, text #F0F0F0, soft green accent #7CB58F; muted green-gray borders.
- Light journal palette: warm cream #F8F6F2, white surface #FFFFFF, dark gray text #1F1F1F, forest green accent #2D5A41 and soft border #E0DCD3. Books retain their stored field colors; light-mode task/reflection markers remain neutral.
- Library contains only the field-grouped horizontal bookshelf and Add Subject. Spines show rotated subject codes with bindings/page lines; tapping reveals one animated front cover with full name/code/count and separate Edit/Close controls. Tapping the cover opens /library/[subjectId], not an inline filter. There is no Show All Tasks control or task list on the shelf screen. Reduced motion remains supported. Light covers keep the original gradients; Dark covers use the same vibrant field gradients, plus dark paper labels, light ink and readable page/binding lines. Original stored colors and backups remain unchanged; serif titles wrap naturally.
- Add Subject requires a name and Field of Study, including combined labels like `Biology, Chemistry`. The field is a searchable dropdown of normalized, case-insensitively deduplicated existing names; typing a new one remains valid. Each shelf has a 44px + action that opens Add Subject with that field already filled. Choose one or two distinct colors from twelve named swatches in either theme, including pure Black/White. Each swatch has a fixed-size colored circle with a gray outline so both extremes remain visible. `utils/subjectFields.js` trims comma-separated labels, validates lengths/hex colors, and supplies a subtle single-color highlight. Services default omitted fields to General / Iris; UI requires explicit field text. Task/block/reflection results retain `subject_color` as the first stored color for existing marker consumers.
- Theme is stored under AsyncStorage key `yotei.theme` as `dark` or `light`, device-wide and independent of sign-out. The provider waits for restoration before mounting screens, defaults to light for missing/invalid/unreadable values while honoring a saved dark choice, serializes rapid writes, and logs storage failures without blocking the current UI. Theme preferences are excluded from study backups.
- Settings labels the current Dark Mode or Light Mode; switch tracks follow the green accent with a white thumb, including the web active-thumb override. Theme guidance/preview use journal colors.
- General instructional paragraphs across screen headings, auth/study forms, and cards are behind small information icons. `FieldLabel` accepts `help`; `InfoButton` opens a local `InfoModal` with the selected theme, Merriweather heading, Inter body, scrollable content, close/OK buttons, backdrop dismissal and Android Back. Its local state works from authentication, tab content and existing sheets without a separate provider. Destructive confirmations still use native Alert. Errors, workload totals/confirmation, import-overwrite warning, demo replacement notice, decision prompts, and the Home motto remain directly visible.
- Keep inputs within keyboard-aware layouts. AuthScreen and inline Reflections use KeyboardAvoidingView. The shared Sheet places KeyboardAvoidingView at the full native Modal viewport, with a shrinking scroll area, scrollable header, and safe-area handling. Shared Input reports focus to Sheet; after focus, keyboard-show, or layout changes, Sheet measures input and scroll viewport in window coordinates and scrolls the field into view. EntrySheet, ScheduleSheet, and CompletionReflectionSheet all inherit this behavior.

## Academic journal UI and Opened Book

- components/typography.js names the exact local faces: Merriweather regular/bold and Inter regular/medium/semibold/bold. Fonts are imported by weight subpath to bundle only those six faces. Explicit fontFamily and normal fontWeight avoid platform-specific synthetic-weight fallback. Screen/card/book titles use Merriweather; inputs, buttons, labels and body text use Inter. Cards use shared soft shadows; serif leading is expanded to avoid clipping. Home progress is always theme green, with workload warnings still visible as text.
- screens/OpenedBookScreen.js reads the route subjectId and finds the subject in the signed-in user's shared dataset. Its notepad header has the subject name/code/field, New Task (preselected subject), Edit Book and native-confirmed Delete Book. Task rows show only that subject, preserving Schedule/Edit/Delete, coaching and future-session missed-badge logic. Invalid/unowned/missing subject IDs redirect to Library after data is ready; refresh errors remain visible. Back uses the nested stack with a Library fallback for direct entry.
- Notebook task rows use the TaskCard notebook variant, soft paper borders and a margin rule rather than separate floating cards. Native scheduling/entry/reflection/material sheets still live above all tabs and retain keyboard avoidance. Saving a session still returns to Home.
- StudyWorkspace.savedEntry suppresses Subject create/edit successes and refreshes data. Other shared success messages use the single ToastTabBar host, never inline Feedback cards. Toast.js slides/fades above the actual tab bar, expires each occurrence after three seconds even while hidden, and clears timers/animations on replacement or unmount. noticeId gives repeated identical messages a fresh lifetime. Settings hides and discards both existing/new notices (including backup notices), so they cannot replay on another tab. Keyboard/sheet/busy states hide the toast without extending its expiry; errors remain inline. Direct book deletion shares the guarded native confirmation/mutation flow with task deletion; the existing edit-sheet deletion remains available.

## UI tuning: defaults, type scale, shelves and field suggestions (2026-10-27)

- components/typography.js defines shared typeScale/typeLeading values for all screens, forms, tab labels and the web notice: H1 28/42, H2 22/32, H3 18/28, body 14/22, small 12/18, button 14/22. Timer/workload metrics use 36/44. Sizes are explicit semantic tokens rather than per-screen numbers; Merriweather/Inter faces and native accessibility scaling remain.
- SubjectBookshelf keeps both cover and spine mounted. One Animated.Value drives width, height, lift, tilt and crossfade in both directions. Close or another revealed book reverses the same transition; cleanup stops interrupted animations. The hidden face has pointer events disabled and is excluded from accessibility. Natural cover height is measured so long/scaled titles are not clipped; reduced motion snaps directly.
- utils/subjectFields.bookGradient derives a dark-only desaturated tint from field colors and the theme background. getFieldsOfStudy normalizes/deduplicates/sorts existing field labels for the subject editor. These helpers do not change stored subject metadata.
- openEntry(kind, subjectId = null, fieldOfStudy = '') carries an optional initialField through StudyWorkspace to EntrySheet. Shelf + calls it for Subject; global Add Subject and editing/task flows reset the preset. The editor prefers existing subject metadata over a creation preset. The field dropdown supports filtered suggestions, an explicit show-all toggle and custom values; keyboard-aware Input/Sheet behavior and failed-save drafts are retained.

## Known boundaries and next-session checks

- Physical-device keyboard/modal/tab appearance and accessibility interaction are not covered by Node tests or bundle export.
- The local root `app/index.tsx` experiment is not part of the active route tree or current TypeScript include set. Preserve it until a specific routing change is authorized.
- Appwrite client configuration is populated and real auth is active. Tests use an SDK substitute; the guest API probe does not prove live account/session behavior.
- `deadline` and `estimated_minutes` are service/schema fields; the task form exposes title, optional description and subject.
- Reflection notes have no edit/delete screen; materials support CRUD and reference opening; study data has no cloud sync or scheduled background notifications.
- There is no `eas.json` in this snapshot, and no store-release validation has been performed.
- Browser study storage is intentionally disabled. App.js checks Platform.OS before mounting sessions/routes and shows a themed mobile-only notice. Metro resolves db/database.web.js instead of database.js, excluding SQLite/WASM from web builds; its storage API rejects explicitly. Native database migrations and study services are unchanged. Full web study support would need a separate implementation.
- Native generated `ios/` and `android/` directories are absent/ignored; configure native behavior through app config/plugins per AGENTS.md.

See [VALIDATION.md](VALIDATION.md) for the dated evidence and [NEXT_SESSION_PROMPT.md](NEXT_SESSION_PROMPT.md) for a concise handoff.
