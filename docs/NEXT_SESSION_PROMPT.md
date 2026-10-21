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
Use functional UI text only. Settings permanently includes
"By students, for students."

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
Add Subject takes field text and one/two choices from ten color swatches in both themes.
Each book has an accessible pencil action that opens the same EntrySheet pre-filled.
updateSubject(userId, subjectId, {name, field_of_study, field_colors}) validates metadata
and updates only the owned row in place. Save refreshes all shared tabs without changing
subject IDs or filter selection. Imported/legacy swatches remain available in the editor.
The filter-reset button is labeled Show All Tasks.
LinearGradient spines retain page/binding details and black titles on light paper labels
in both themes; bookshelf/swatch colors are exceptions to light-mode monochrome chrome.
One-color spines get a subtle shade; two-color spines blend the selected pair.
Task/block/review subject_color results derive the first field color; light markers stay black.
Task cards no longer display non-editable estimated_minutes.
Shared Sheet has full-modal keyboard avoidance, a shrinkable scroll area,
scrollable header, and focused-input reveal using viewport measurements;
all Entry/Schedule/Completion sheets inherit it.

Scheduler: native Start/End calendar and time controls using Expo-installed
@react-native-community/datetimepicker 9.1.0. Dates can be next week or later;
there are no manual text fields or Today/Tomorrow toggles. Android uses
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
Warn only when a local day's scheduled+done study time would exceed
240 minutes; explicit confirmation can override. Missed history is
excluded; cross-midnight workload is split by local day.
Expired scheduled blocks become missed. Reschedule retains the original
and creates one replacement via rescheduled_from. A SQLite trigger
increments task.postpone_count once; DO NOT add a second increment.
Coaching appears when that count is at least 2.

Mark Done opens CompletionReviewSheet. Yes creates a ReviewItem under the
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
JSON format is yotei.study-backup, exports version 2 (subject field metadata),
imports versions 1 and 2, with a 20 MB limit. Version 1 colors migrate to General.
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
The full SQLite schedule->done->review->miss->reschedule/count loop is
tested. Native UI gestures, keyboard/modal appearance, live Appwrite,
web storage, and release builds have not been validated by those checks.
The native backup picker/share sheet still needs a physical-device check.

Use npx expo install for packages; fetch matching SDK docs before Expo/RN
API changes. Run lint/typecheck and relevant tests. On this PowerShell
setup, npm.cmd/npx.cmd avoid blocked .ps1 shims. Start with
npx.cmd expo start --clear; do not use npx start.

My next task is:
[Describe the requested change, current error if any, and success criteria.]
```
