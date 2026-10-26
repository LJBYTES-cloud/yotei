# Context for a new session

Copy the block below into a new chat, then append the next task. Keep the repository documents with the source code so they can be inspected directly.

```text
I am continuing Yotei, an Expo/React Native study planner.
Workspace: C:\Users\Dawn-BYTES\Documents\Yotei-Engine\yotei

Before changing anything, read AGENTS.md, README.md,
docs/PROJECT_CONTEXT.md, and docs/VALIDATION.md. Inspect git status and
current files; preserve my uncommitted work. The handoff snapshot is dated
2026-10-21 (Asia/Singapore), baseline commit edfb6ab.

Current stack: Expo ~57.0.31, React Native 0.86.3, React 19.2.3, npm.
JavaScript uses JSDoc/checkJs; Expo Router wrappers use TSX.
main=index.js imports the URL polyfill first, then expo-router/entry.
Active routes are src/app/. src/app/_layout.tsx re-exports App.js, which
owns providers and the protected root stack. screens/ contains screen UI.
A separate root app/index.tsx is a preserved Hello World experiment,
untracked at the start of the handoff. Metro exports currently select
src/app/. Diagnose that distinction before moving or deleting routes.

There are four themed Ionicons tabs: Home, Library, Review, Settings.
StudyWorkspace and useDashboardData share data/actions across them.
Keep the current cards, borders, icons, 20px padding, and both themes.
Dark defaults to #0C1117 with purple; light is monochrome #F5F5F5,
white cards, gray borders, black text/actions. AsyncStorage saves theme selection
under yotei.theme and restores it before screens mount (dark fallback).
Use functional UI text only. Home's list footer includes
"By students, for students." Settings labels the current Dark Mode/Light Mode;
the light switch is monochrome, including its web active thumb. Subject creation
has twelve visible circle swatches, including pure Black and White.
App.js shows a mobile-only notice on web before mounting sessions/routes;
db/database.web.js excludes SQLite/WASM from the browser bundle. Native storage
continues using db/database.js. Browser study functionality is not implemented.

Auth uses AuthService with Mock and Appwrite adapters; public users are
{id,name,email}. USE_REAL_AUTH is currently true for real login diagnostics.
Set it false and fully reload for Mock mode. Mock demo login is
student@yotei.demo / study12345. Remember me defaults off and controls
cleanup on cold boot. Custom mock credentials are not persisted.
Appwrite public config is populated; live auth needs separate validation.
The Appwrite adapter logs its public endpoint/project/platform and exact
signIn/signUp failure code/message/type, trims email, and propagates the
original error to the UI. Signup awaits automatic login. A read-only guest
GET /account probe returned 401 general_unauthorized_scope with the configured
project, establishing API reachability rather than a successful login.

SQLite yotei.db has Subject, Task, StudyBlock, ReviewItem, Material.
Every service scopes ownership to user.id directly or through joins.
Study data is local; Appwrite is not a cloud-sync layer.

Latest UX: shared cards have 24px vertical separation and 20px internal
padding. Library uses horizontal shelves grouped by field_of_study (case-insensitive).
Subject replaces color with field_of_study and comma-separated field_colors.
Migration preserves IDs and dependencies, maps legacy colors to General, and drops color.
Subject has subject_code TEXT, migrated in place with GEN-101 default. Codes normalize
uppercase (1?32 letters/numbers plus spaces . / _ -). Add/Edit Subject includes the
code; old updateSubject callers omitting it retain the current value.
Add Subject takes field text and one/two choices from twelve color swatches in both themes.
Each book has an accessible pencil action that opens the same EntrySheet pre-filled.
updateSubject(userId, subjectId, {name, field_of_study, field_colors}) validates metadata
and updates only the owned row in place. Save refreshes all shared tabs without changing
subject IDs or filter selection. Imported/legacy swatches remain available in the editor.
The filter-reset button is labeled Show All Tasks.
Task cards have Edit and Delete actions. The shared EntrySheet prefills title/subject;
updateTask(userId, taskId, {title, subject_id}) changes only those owned fields.
deleteTask(userId, taskId) requires native Cancel/Delete confirmation, cascades blocks,
and keeps subject reviews/material notes (Material.task_id becomes null). All tabs refresh.
getTasksForUser derives has_missed_session and latest_scheduled_start across all dates.
Library hides Missed Session when any status=scheduled block starts in the future;
Home's missed history and postpone_count/coaching remain unchanged. Do not derive this
badge from the Home date-filtered blocks. tests/task-library.test.cjs covers UI wiring.
Edit Subject also has a red Delete Subject button at the bottom, with native
Cancel/Delete confirmation. deleteSubject(userId, subjectId) uses an owned DELETE;
SQLite cascades its tasks/blocks/reviews/materials. Success closes the sheet and
refreshes shared data; Library clears a deleted subject's filter. Cancel/failure
keeps the editor/draft. Duplicate taps and competing saves are guarded.
Run node --experimental-vm-modules --test tests/subject-deletion.test.cjs for
the actual EntrySheet callback tests; SQL cascade coverage is in database.test.cjs.
Closed gradient spines show only subject_code rotated 90 degrees, with bindings/pages.
Tap a spine to animate out its cover using standard Animated with reduced-motion support.
The cover shows full name/code/task count, Return, and separate Edit controls. Revealing
never filters; tapping the cover body does, with selected indicators. Show All Tasks
resets filtering and closes the cover. Book/swatch colors remain exceptions in light mode.
One-color spines get a subtle shade; two-color spines blend the selected pair.
Task/block/review subject_color results derive the first field color; light markers stay black.
Task cards no longer display non-editable estimated_minutes.
Shared Sheet has full-modal keyboard avoidance, a shrinkable scroll area,
scrollable header, and focused-input reveal using viewport measurements;
all Entry/Schedule/Completion sheets inherit it.

Scheduler: native Start/End calendar and time controls using Expo-installed
@react-native-community/datetimepicker 9.1.0. Dates can be next week or later;
there are no Today/Tomorrow toggles. Optional Duration accepts 4h 30m / 45m / 2h or
bare whole minutes and calculates End. Moving Start retains duration; editing End clears
the shortcut. Invalid drafts block Save, including keyboard submission. Helpers
parseStudyDuration/applyStudyDuration in utils/scheduling.js add elapsed minutes across
midnight/DST and preserve the SQLite workload warning. Android uses
imperative dialogs; iOS uses compact controls. DateTimeField owns the native UI.
Default start is the next whole minute; end is prefilled from the existing
30m suggestion, 5m coaching action, or original missed-block duration.
buildStudyTimes({start:Date,end:Date}, now) rejects only already-passed starts,
invalid dates and nonpositive windows. 5 PM today is valid at 4 PM today.
updateStudyWindow merges only the picked calendar/clock component, preserves
duration when Start moves, and edits End independently. Native repeated-hour
instants retain offsets; unavailable local times after date changes fail.
Frozen workload-warning times are validated again before Save anyway.
Minutes are derived from actual elapsed instants for the existing guardrail.

Instructions now live in FieldLabel/InfoButton native popups across headings,
auth/study forms and cards; warnings/errors and decision prompts stay visible.
The bookshelf has page/binding lines, shaded grooves and a themed shelf lip;
long titles wrap fully rather than being cut to four lines.
Warn only when a local day's scheduled+active+done planned study time would exceed
240 minutes; explicit confirmation can override. Missed history is
excluded; cross-midnight workload is split by local day.
Expired scheduled blocks become missed. Reschedule retains the original
and creates one replacement via rescheduled_from. A SQLite trigger
increments task.postpone_count once; DO NOT add a second increment.
Coaching appears when that count is at least 2.

Commitment Focus Timer: Start Session is available inside a scheduled window.
startStudyBlock stamps actual_start_time and status active; pauseStudyBlock sets
break_started_at; resumeStudyBlock adds the break to break_time_ms, updates floored
break_time_minutes, and clears its anchor. finishStudyBlock sets done, actual_end_time,
and actual_study_seconds (wall time minus breaks, floored once). All six fields
migrate in place with null/zero defaults and survive restart/backup.
One active session per account; retries preserve timestamps/totals. Active blocks
remain visible past midnight/end and are not marked missed. FocusTimer replaces
their normal Home card, shows lateness/work/current+total breaks, and updates each
second while focused/foreground. Work/break mode continues while away; timestamps
ensure correct catch-up without background JS. Planned workload stays unchanged.
Finish Session opens CompletionReviewSheet. Yes creates a ReviewItem under the
completed block's subject_id; No/Skip keeps the block done without adding
a topic. Creation errors preserve the topic for retry. ReviewService
returns a composed created item to avoid a fallible post-insert read.

Review Queue: new/null-timestamp topics are due immediately; due means
next_review_at <= now. Hard/Good/Easy schedule 1/3/7 local calendar days.
Rating is guarded against duplicate taps. These are fixed intervals.
The UI shows only Hard/Good/Easy buttons without interval labels, popup hints,
or interval announcements; successful rating reports "Review saved."

Mock-only Load Demo Data resets only that user's records in a transaction:
3 subjects, 6 tasks with today/tomorrow/overdue deadlines, 2 coaching tasks,
4 blocks totaling exactly 240 minutes today, and 3 due review topics.
Elapsed seeded blocks are done so missed detection preserves the total.

Data backup: Settings > Data Management exports/imports the five study
collections with db/BackupService.js. expo-file-system uses SDK 57 File/Paths;
expo-sharing and expo-document-picker provide native share/pick UI.
JSON format is yotei.study-backup, exports version 4 (codes/fields/timer metadata),
imports versions 1?4 with a 20 MB limit. Versions 1?3 get GEN-101 codes; only
versions 1/2 get empty timer defaults, while version-3 timer values are preserved;
version 1 colors migrate to General. Validate timer states/totals and one active block.
Validate before deletion; replace only the signed-in account atomically;
allocate fresh IDs and remap every relation. Set rescheduled_from by UPDATE
after block insertion so historical postponements are not counted again.
Successful imports refresh shared tab data and increment demoRevision to
clear stale subject selections/drafts. Authentication and attached file
bytes are excluded (material paths/notes are included). Native only; see
docs/DATA_BACKUP.md for the complete format and file-by-file changelog.

Backup verification: lint/typecheck, 79 combined auth/DB/backup tests,
SDK dependency check, and Android/iOS exports passed. The subsequent auth
diagnostics pass adds five tests: lint/typecheck pass and all 84 combined
tests pass (24 auth, 38 database, 22 backup). See VALIDATION.md for evidence.
The 2026-10-22 UX pass passes lint/typecheck and native bundle exports.
Combined suites in Singapore: 89 cases, 88 passed and one New York DST-only
skip. New York database suite: all 43 pass, including that DST case.
The subsequent native-picker/info/bookshelf refinement passes lint/typecheck,
SDK compatibility and Android/iOS exports. Combined Singapore suites now
have 90 cases (89 pass, one NY-only skip); all 44 NY database tests pass.
The latest fields/gradients/theme-persistence pass passes lint/typecheck,
SDK compatibility and Android/iOS exports (.expo/fields-verification).
Combined auth/DB/backup/theme suites: 96 cases, 95 pass, one NY-only skip;
all 45 New York DB cases pass. npm run test:theme runs the new provider tests.
Native picker/alert gestures and styling still need a phone check; rebuild an
existing custom development client for the newly added native picker module.
Earlier DB tests also passed in America/New_York.
The latest focus-timer pass: lint/typecheck and Android/iOS exports pass;
111 combined cases (110 pass, one NY-only skip); all 54 NY DB cases pass.
tests/focus-timer.test.cjs exercises the actual timer component with native bridges
substituted; production SQL covers persistence, precision, retries and review flow.
The full SQLite schedule->done->review->miss->reschedule/count loop is
tested. Native UI gestures, keyboard/modal appearance, live Appwrite,
web storage, and release builds have not been validated by those checks.
The 2026-10-24 UI/web-guard pass passes lint/typecheck and a web export with
no WASM assets or SQLite loader signatures. Database/subject-deletion/web suites:
60 total, 59 pass, one NY-only skip. Browser study storage is intentionally
disabled; native visual checks remain manual.
The native backup picker/share sheet still needs a physical-device check.

Use npx expo install for packages; fetch matching SDK docs before Expo/RN
API changes. Run lint/typecheck and relevant tests. On this PowerShell
setup, npm.cmd/npx.cmd avoid blocked .ps1 shims. Start with
npx.cmd expo start --clear; do not use npx start.

My next task is:
[Describe the requested change, current error if any, and success criteria.]
```
