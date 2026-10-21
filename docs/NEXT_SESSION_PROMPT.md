# Context for a new session

Copy the block below into a new chat, then append the next task. Keep the repository documents with the source code so they can be inspected directly.

```text
I am continuing Yotei, an Expo/React Native study planner.
Workspace: C:\Users\Dawn-BYTES\Documents\Yotei-Engine\yotei

Before changing anything, read AGENTS.md, README.md,
docs/PROJECT_CONTEXT.md, and docs/VALIDATION.md. Inspect git status and
current files; preserve my uncommitted work. The handoff snapshot is dated
2026-10-21 (Asia/Singapore), baseline commit edfb6ab.

Current stack: Expo ~57.0.30, React Native 0.86.3, React 19.2.3, npm.
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
white cards, gray borders, black text/actions. Theme selection is currently
in memory. Use functional UI text only. Settings permanently includes
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

Scheduler: custom positive whole minutes and Now/future local HH:mm.
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

Mock-only Load Demo Data resets only that user's records in a transaction:
3 subjects, 6 tasks with today/tomorrow/overdue deadlines, 2 coaching tasks,
4 blocks totaling exactly 240 minutes today, and 3 due review topics.
Elapsed seeded blocks are done so missed detection preserves the total.

Data backup: Settings > Data Management exports/imports the five study
collections with db/BackupService.js. expo-file-system uses SDK 57 File/Paths;
expo-sharing and expo-document-picker provide native share/pick UI.
JSON format is yotei.study-backup, version 1, with a 20 MB limit.
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
