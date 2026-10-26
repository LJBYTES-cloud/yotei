# Context for a New Session

Copy this block into the next tool/chat and append the next task.

```text
Continue Yotei at C:\Users\Dawn-BYTES\Documents\Yotei-Engine\yotei.
Read AGENTS.md, README.md, PROJECT_CONTEXT.md and VALIDATION.md first.
Inspect git status and preserve uncommitted/untracked work. Active routes use
src/app/, not the preserved root app/index.tsx experiment. main=index.js loads
the URL polyfill before expo-router/entry. App.js owns providers and six bundled
Merriweather/Inter faces. JavaScript uses JSDoc/checkJs; route wrappers use TSX.
Expo ~57.0.31, RN 0.86.3, React 19.2.3, npm. Use npx expo install and fetch
versioned SDK docs before Expo/RN API changes. Use expo-router and its js-tabs
exports for navigation (not external @react-navigation imports on SDK 57).

Current tabs: Home, Library (nested subject notebooks), Reflections, Settings.
The old review.tsx route, ReviewScreen, ReviewService and CompletionReviewSheet
were replaced with reflections.tsx, ReflectionsScreen, ReflectionService and
CompletionReflectionSheet. No spaced-repetition rating or due-date flow remains.

Academic journal styling: Light fallback #F8F6F2 / #FFFFFF / #1F1F1F / #2D5A41.
Dark #121412 / #1C201D / #F0F0F0 / #7CB58F. AsyncStorage yotei.theme restores
before screens mount; saved Dark still wins. Merriweather headings, Inter body,
20px screen padding, bordered/shadowed 16px cards with 24px separation. Shared
typography scale lives in components/typography.js. Static headings/labels use
Title Case; user content and explanatory/error/success sentences keep casing.
Home's footer motto: By students, for students.

Both themes now use the SAME vibrant field gradients on book spines/covers.
Dark titles/codes remain light on dark paper labels. Spines show subject_code,
then animate to a cover; covers open /library/[subjectId]. Close reverses the
same animation, including interruptions/reduced motion. Shelves group by field,
have + actions prefilling that field, and smart existing/custom field dropdowns.
Subject edit/delete are owned and confirmed; deletion cascades related data.

StudyWorkspace/useDashboardData share owned data/actions across tabs. Mutations
and global sheets lock competing operations. Toast.js + ToastTabBar show shared
successes above the actual tab bar for 3 seconds, with unique noticeId occurrences.
Settings hides and discards all successes (including backup notices); keyboard/
sheet states hide without extending expiry. Inline Feedback only shows errors.
InfoButton uses themed InfoModal, with native alerts reserved for confirmations.
InfoModal also supports children for chart details.

Authentication remains adapter-based and normalizes {id,name,email}. Appwrite is
currently selected; Mock credentials are student@yotei.demo / study12345.
Remember Me defaults false and both adapters clear non-remembered sessions on
cold boot. Appwrite diagnostics log public target config plus code/message/type,
never passwords. Credentials heading now says Welcome Back. Do not switch the
auth adapter automatically. Study data is local SQLite, not cloud-synchronized.

Load Demo Data is explicitly available in Settings with BOTH auth adapters.
It replaces only the signed-in account's local data in a transaction: 3 subjects,
6 described tasks, 10 blocks (4 planned hours today plus 6 historical completed
dates with 60/90/75/120/105/150 minutes), 3 linked reflections and 3 material URLs.
Do not run it on user device data without their action. It keeps auth unchanged.

Tables: Subject, Task, StudyBlock, ReflectionItem, Material. Task.description is
optional nullable TEXT, max 4000 characters; omitted updates preserve it, empty
input clears it. EntrySheet is multiline; notebook TaskCard displays it.
ReflectionItem columns: id, subject_id, nullable study_block_id, note, created_at.
Legacy ReviewItem topics/IDs/subjects migrate transactionally, using last review
or migration timestamp as created_at; obsolete schedules are retired. Block links
use ON DELETE SET NULL, subject deletion cascades notes. ReflectionService requires
an owned subject and, if provided, an owned done session in that subject. It
resolves reads before inserting and returns a composed result to avoid duplicates
after post-insert read failures. Finish Session is durable before the optional
reflection form opens; failed note saving retains the draft, Skip keeps done.
ReflectionsScreen groups notes by subject with newest first and a standalone form.

StudyMaterials/MaterialSheet live in the opened book. MaterialService provides
owned CRUD. Save only title and URL/path references, not uploads. HTTP(S), www,
file/content URIs and absolute Windows/device paths are normalized for
Linking.openURL; invalid schemes/relative paths reject. OS access failures show a
recoverable error. Delete removes the link, not the actual file. Old note/path
metadata is preserved by backups even if it cannot open on the current device.

Scheduler uses native full Start/End dates, optional duration text such as 4h 30m,
strict timestamp validation and SQLite workload >240 minutes with explicit override.
Missed detection runs on refresh/foreground/ticks. Rescheduling preserves history;
a unique replacement index and INSERT trigger increment postpone_count once.
Coaching starts at 2. Timer active/break state persists in StudyBlock timestamps,
break_time_ms/minutes and actual_study_seconds; at most one active block per user.
Active blocks remain reachable past midnight/end and never auto-miss. Background
elapsed mode continues. Timer completion prompts the reflection sheet.

WeeklyProgressCard uses root LineChart from Chart Kit 7.0.4 and SVG 15.15.4.
ProgressService returns 7 local completion-date buckets, including zeros. Done
sessions count actual work seconds excluding breaks; untimed legacy completions
use scheduled duration. Overnight work credits the entire completion day. This is
separate from the planned workload guardrail. Point taps open ProgressDetailsModal
with allocated/studied/break/elapsed/overrun minutes and task titles from owned SQL.
Background opens total/average-over-7/best-day summary; day rows open details too.
Point taps must not bubble into the weekly background action. No separate planned
break budget exists; show the stored whole allocated session honestly.

Backup exports version 5, imports 1-5. Required arrays: subjects, tasks,
studyBlocks, reflectionItems, materials. Include description and remap reflection
session IDs. Legacy reviewItems convert to notes using last_reviewed_at/exported_at;
legacy descriptions default null. Existing field/code/timer defaults remain.
Validate before deletion; atomically replace only current account; remap IDs and
attach reschedule links by UPDATE to preserve postponement counts. 20 MB limit.
Passwords, sessions, theme choice and actual file bytes are excluded. Import
refreshes shared data and resets stale drafts through demoRevision.

Run lint/typecheck and the full current tests in DEMO_AND_TESTING.md. Tests use
real node:sqlite plus VM/native bridges on Node 24. New interaction coverage is in
task-library and notifications suites; old rating tests were replaced by reflection
and migration tests. Check both Asia/Singapore and America/New_York for dates.
Bundle Android/iOS/web as appropriate. Browser deliberately renders a mobile-only
notice; database.web.js excludes SQLite/WASM, not a web storage implementation.
Native gestures/appearance, Appwrite live login and OS file access need a device.

Use npm.cmd/npx.cmd on this PowerShell setup if ps1 shims are blocked.
Start: npx.cmd expo start --clear. Never use npx start.
Next task:
[Describe the change and acceptance criteria.]
```
